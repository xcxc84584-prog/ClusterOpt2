import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";

test("PR12 root close No discards contained unsaved tabs", async () => {
  const previous = globalThis.window;
  globalThis.window = { confirm: () => false };
  try {
    const core = new LinkCore();
    const ws = new FileWorkspace(core, () => {});
    new Explorer(core);
    core.register({ id: "tester", receive: async () => null,
      authorization: { default: "Public" } });
    const handle = { kind: "file", name: "file.txt" };
    const root = { kind: "directory", name: "root",
      async *values() { yield handle; },
      async resolve(other) { return other === handle ? ["file.txt"] : null; }
    };
    const imported = await core.request("tester", "explorer",
      "importFolder", { handle: root });
    ws.create();
    ws.active.handle = handle;
    const result = await core.request("tester", "explorer",
      "closeRoot", { id: imported.value });
    assert.equal(result.ok, true);
    assert.equal(ws.documents.length, 0);
    const list = await core.request("tester", "explorer", "list");
    assert.equal(list.value.length, 0);
  } finally {
    globalThis.window = previous;
  }
});

test("PR12 root close Yes with failed save retains tabs and root", async () => {
  const previous = globalThis.window;
  globalThis.window = { confirm: () => true };
  try {
    const core = new LinkCore();
    const ws = new FileWorkspace(core, () => {});
    new Explorer(core);
    core.register({ id: "tester", receive: async () => null,
      authorization: { default: "Public" } });
    const handle = { kind: "file", name: "file.txt" };
    const root = { kind: "directory", name: "root",
      async *values() { yield handle; },
      async resolve(other) { return other === handle ? ["file.txt"] : null; }
    };
    const imported = await core.request("tester", "explorer",
      "importFolder", { handle: root });
    ws.create();
    ws.active.handle = handle;
    const result = await core.request("tester", "explorer",
      "closeRoot", { id: imported.value });
    assert.equal(result.ok, false);
    assert.equal(ws.documents.length, 1);
    const list = await core.request("tester", "explorer", "list");
    assert.equal(list.value.length, 1);
  } finally {
    globalThis.window = previous;
  }
});
