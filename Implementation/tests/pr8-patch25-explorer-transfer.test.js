import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";

function directory(name) {
  const entries = new Map();
  return {
    kind: "directory", name, entries,
    async *values() { yield* entries.values(); },
    async getDirectoryHandle(child, { create = false } = {}) {
      if (create && !entries.has(child)) {
        entries.set(child, directory(child));
      }
      if (!entries.has(child)) throw Error("Missing directory");
      return entries.get(child);
    },
    async getFileHandle(child, { create = false } = {}) {
      if (create && !entries.has(child)) {
        const state = { bytes: new Blob([]), corrupt: false };
        const handle = {
          kind: "file", name: child, state,
          async getFile() { return state.bytes; },
          async createWritable() {
            return {
              async write(blob) {
                state.bytes = state.corrupt ? new Blob(["wrong"]) : blob;
              },
              async close() {},
              async abort() {}
            };
          }
        };
        entries.set(child, handle);
      }
      if (!entries.has(child)) throw Error("Missing file");
      return entries.get(child);
    },
    async removeEntry(child) { entries.delete(child); }
  };
}

function setup() {
  const core = new LinkCore();
  new FileWorkspace(core, () => {});
  const explorer = new Explorer(core);
  core.register({
    id: "actor", authorization: { default: "Public" },
    receive: async () => null
  });
  const call = (action, payload) =>
    core.request("actor", "explorer", action, payload);
  return { core, explorer, call };
}

test("PR8+25 Explorer cut verifies destination before source removal",
  async () => {
    const { core, explorer, call } = setup();
    const root = directory("root");
    const original = await root.getFileHandle("data.txt", { create: true });
    original.state.bytes = new Blob(["critical user content"]);
    await root.getDirectoryHandle("destination", { create: true });
    const opened = await call("importFolder", { handle: root });
    assert.equal(opened.status, 200);
    const rootId = opened.value;
    const nodes = explorer.findNode(rootId).children;
    const fileId = nodes.find(item => item.name === "data.txt").id;
    const destinationId = nodes.find(item =>
      item.name === "destination").id;
    assert.equal((await call("cutEntry", { id: fileId })).status, 200);
    const destination = root.entries.get("destination");
    // Detect a corrupted write and keep the original untouched.
    const originalGetFile = destination.getFileHandle;
    destination.getFileHandle = async (...args) => {
      const handle = await originalGetFile(...args);
      handle.state.corrupt = true;
      return handle;
    };
    const refused = await call("pasteEntry", { id: destinationId });
    assert.equal(refused.status, 409);
    assert.equal(await (await original.getFile()).text(),
      "critical user content");
    assert.equal(root.entries.has("data.txt"), true);
    assert.equal(destination.entries.has("data.txt"), false);
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" && item.status === 409));
    destination.getFileHandle = originalGetFile;
    const completed = await call("pasteEntry", { id: destinationId });
    assert.equal(completed.status, 200);
    assert.equal(root.entries.has("data.txt"), false);
    assert.equal(await (await destination.entries.get(
      "data.txt").getFile()).text(), "critical user content");
  });
