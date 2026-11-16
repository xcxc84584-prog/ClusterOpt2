import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { Explorer } from "../object/Explorer.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { FileTypeManager } from "../object/FileTypeManager.js";

/** Real OCDA objects use a detached VTE core and mock directory handles. */
test("PR6/PR7 VTE validates Explorer and File Tool Request/Response", async () => {
  const vte = new VirtualTestEnvironment();
  assert.equal(vte.create("actor").status, 201);
  const workspace = new FileWorkspace(vte.core, () => {});
  new Explorer(vte.core);
  new FileTypeManager(vte.core, null);

  const directory = {
    kind: "directory", name: "workspace",
    async *values() {
      yield { name: "alpha.txt", kind: "file" };
      yield { name: "beta.txt", kind: "file" };
    },
    async resolve() { return null; }
  };
  const request = (target, action, payload = {}) =>
    vte.core.request("VTE.actor", target, action, payload);

  const imported = await request("explorer", "importFolder", {
    handle: directory
  });
  assert.equal(imported.status, 200);
  let tree = await request("explorer", "list");
  assert.deepEqual(tree.value[0].children.map(x => x.name),
    ["alpha.txt", "beta.txt"]);

  const children = tree.value[0].children;
  const order = await request("explorer", "reorder", {
    sourceId: children[1].id, targetId: children[0].id
  });
  assert.equal(order.ok, true);
  tree = await request("explorer", "list");
  assert.deepEqual(tree.value[0].children.map(x => x.name),
    ["beta.txt", "alpha.txt"]);

  const blocked = await request("file-types", "add", {
    extension: ".txt"
  });
  assert.equal(blocked.status, 200);
  tree = await request("explorer", "list");
  assert.equal(tree.value[0].children.length, 0);
  assert.equal(workspace.documents.length, 0);

  const invalid = await request("file-types", "add", {
    extension: "../bad"
  });
  assert.equal(invalid.status, 400);
  assert.ok(vte.log().some(item =>
    item.kind === "EHU" && item.status === 400));

  const closed = await request("explorer", "closeRoot", {
    id: imported.value
  });
  assert.equal(closed.status, 200);
  const after = await request("explorer", "list");
  assert.equal(after.value.length, 0);
  assert.ok(vte.snapshot().dependencies.some(item =>
    item.link === "VTE.actor->explorer" && item.code === "10"));
  assert.ok(vte.snapshot().dependencies.some(item =>
    item.link === "explorer->VTE.actor" && item.code === "01"));
});
