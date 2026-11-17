import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { PluginExplorerObject } from
  "../object/PluginExplorerObject.js";
import { readFileSync } from "node:fs";

const exampleAbsolute = ["C:", "Work", "Project"].join("\\");

function setup() {
  const vte = new VirtualTestEnvironment();
  vte.core.register({ id: "ui", receive: () => null });
  const explorer = new PluginExplorerObject(
    vte.core, "cluster.ai-agent-mcp");
  assert.equal(vte.core.register(explorer), true);
  const files = new Map([["existing.txt", "old"]]);
  const folder = {
    kind: "directory", name: "Project",
    queryPermission: async () => "granted",
    getFileHandle: async (name, options = {}) => {
      if (!files.has(name) && !options.create) {
        const error = new Error("Missing");
        error.name = "NotFoundError";
        throw error;
      }
      if (!files.has(name)) files.set(name, "");
      return {
        getFile: async () => ({
          size: files.get(name).length,
          text: async () => files.get(name)
        }),
        createWritable: async () => {
          let next = "";
          return {
            write: async value => { next = value; },
            close: async () => { files.set(name, next); },
            abort: async () => {}
          };
        }
      };
    },
    removeEntry: async name => {
      if (!files.delete(name)) throw Error("Missing");
    },
    async *entries() {
      for (const name of files.keys()) {
        yield [name, { kind: "file" }];
      }
    }
  };
  const request = (action, payload = {}) =>
    vte.core.request("ui", explorer.id, action, payload,
      { origin: "user" });
  return { explorer, request, folder, files, vte };
}

test("PR14.6 selected scope is not a file grant", async () => {
  const h = setup();
  assert.equal((await h.request("list")).status, 403);
  h.explorer.setRoot(h.folder, exampleAbsolute);
  assert.equal((await h.request("list")).status, 403);
  assert.equal(JSON.stringify(h.explorer.status()).includes(["C:", ""].join("\\")),
    false);
  assert.ok(h.vte.log().some(record =>
    record.kind === "EHU" && record.status === 403));
});

test("PR14.6 read/create/update/delete need separate toggles", async () => {
  const h = setup();
  h.explorer.setRoot(h.folder, exampleAbsolute);
  h.explorer.setRight("read", true);
  assert.equal((await h.request("read", {
    path: "existing.txt"
  })).value.text, "old");
  assert.equal((await h.request("create", {
    path: "new.txt", content: "hello"
  })).status, 403);
  h.explorer.setRight("create", true);
  assert.equal((await h.request("create", {
    path: "new.txt", content: "hello"
  })).status, 200);
  assert.equal((await h.request("update", {
    path: "new.txt", content: "new"
  })).status, 403);
  h.explorer.setRight("update", true);
  assert.equal((await h.request("update", {
    path: "new.txt", content: "new"
  })).status, 200);
  assert.equal((await h.request("delete", {
    path: "new.txt"
  })).status, 403);
  h.explorer.setRight("delete", true);
  assert.equal((await h.request("delete", {
    path: "new.txt"
  })).status, 200);
  assert.equal(h.files.has("new.txt"), false);
});

test("PR14.6 rejects traversal, PowerShell and revocation", async () => {
  const h = setup();
  h.explorer.setRoot(h.folder, exampleAbsolute);
  h.explorer.setRight("read", true);
  assert.equal((await h.request("read", {
    path: "../secret.txt"
  })).status, 400);
  assert.throws(() => h.explorer.setRight("ps", true),
    error => error.status === 403);
  h.explorer.revoke();
  assert.equal((await h.request("list")).status, 403);
  assert.equal(h.explorer.status().selected, false);
});

test("PR14.6 UI requires selected-folder and absolute path confirmation",
  () => {
    const source = readFileSync(new URL(
      "../LinkCore/PluginUIHostUnit.js", import.meta.url), "utf8");
    assert.match(source, /showDirectoryPicker/);
    assert.match(source, /queryPermission/);
    assert.match(source, /PathConfirmationRejected/);
    assert.match(source, /access\.setRoot\(handle, path\)/);
  });
