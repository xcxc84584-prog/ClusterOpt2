import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { FileDocument } from "../object/FileDocument.js";

function setup(handle) {
  const core = new LinkCore();
  const workspace = new FileWorkspace(core, () => {});
  const doc = new FileDocument("user.txt", handle);
  doc.text = "UNSAVED EDIT";
  doc.revision = 3;
  doc.diskRevision = "100:12";
  doc.status = "yellow";
  core.register(doc);
  workspace.documents.push(doc);
  workspace.activeId = doc.id;
  core.register({
    id: "tester", authorization: { default: "Public" },
    receive: async () => null
  });
  const call = (action, payload = {}) =>
    core.request("tester", "workspace", action, payload);
  return { core, workspace, doc, call };
}

test("PR8+25 Fix2: denied queryPermission skips polling and preserves edits",
  async () => {
    let reads = 0;
    const handle = {
      kind: "file", name: "user.txt",
      queryPermission: async () => "prompt",
      getFile: async () => {
        reads++;
        throw new DOMException("Denied", "NotAllowedError");
      }
    };
    const { doc, call } = setup(handle);
    for (let i = 0; i < 3; i++) {
      assert.equal((await call("syncExternal")).status, 200);
    }
    assert.equal(reads, 0);
    assert.equal(doc.accessBlocked, true);
    assert.equal(doc.text, "UNSAVED EDIT");
    assert.equal(doc.status, "yellow");
    assert.equal(doc.revision, 3);
  });

test("PR8+25 Fix2: unsupported queryPermission fails once, not every tick",
  async () => {
    let reads = 0;
    const handle = {
      kind: "file", name: "user.txt",
      async getFile() {
        reads++;
        throw new DOMException("Denied", "NotAllowedError");
      }
    };
    const { core, doc, call } = setup(handle);
    assert.equal((await call("syncExternal")).status, 200);
    assert.equal(reads, 1);
    assert.equal(doc.accessBlocked, true);
    assert.equal((await call("syncExternal")).status, 200);
    assert.equal(reads, 1);
    assert.equal(doc.text, "UNSAVED EDIT");
    assert.equal(doc.status, "yellow");
    assert.ok(!core.getSnapshot().logs.some(entry =>
      entry.kind === "EHU" && entry.action === "Response.reconcile"));
  });

test("PR8+25 Fix2: repicking the same file resumes same tab",
  async () => {
    let reads = 0;
    const original = {
      kind: "file", name: "user.txt",
      isSameEntry: async () => true,
      async getFile() {
        reads++;
        throw new DOMException("Denied", "NotAllowedError");
      }
    };
    const { workspace, doc, call } = setup(original);
    assert.equal((await call("syncExternal")).status, 200);
    assert.equal(doc.accessBlocked, true);
    const replacement = {
      kind: "file", name: "user.txt",
      isSameEntry: async () => true,
      async getFile() {
        reads++;
        return new File(["UNSAVED EDIT"], "user.txt", {
          lastModified: 100
        });
      }
    };
    const opened = await call("open", { handles: [replacement] });
    assert.equal(opened.status, 200);
    assert.equal(opened.value, doc.id);
    assert.equal(workspace.documents.length, 1);
    assert.equal(doc.handle, replacement);
    assert.equal(doc.accessBlocked, false);
    assert.equal(doc.text, "UNSAVED EDIT");
    assert.equal((await call("syncExternal")).status, 200);
    assert.equal(doc.accessBlocked, false);
  });
