import test from "node:test";
import assert from "node:assert/strict";
import { PluginFolderPackageUnit } from
  "../LinkCore/PluginFolderPackageUnit.js";
import { PluginFolderPackagePolicy } from
  "../property/PluginFolderPackagePolicy.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function manifest() {
  return JSON.stringify({
    packageVersion: 1, name: "Folder extension", entry: "src/main.js",
    uiEntry: "index.html",
    provider: {
      manifestVersion: 1, providerId: "test.folder",
      objectId: "Test.Folder", provides: [{
        service: "editor.syntax.tokens", action: "tokenize",
        version: "1.0.0", inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }],
      requires: [], permissions: [],
      execution: { isolation: "worker", concurrency: "serial" }
    }
  });
}

function file(text, binary = false) {
  const bytes = binary ? new Uint8Array(text) :
    new TextEncoder().encode(text);
  return {
    kind: "file",
    async getFile() {
      return {
        size: bytes.length,
        async arrayBuffer() { return bytes.slice().buffer; }
      };
    }
  };
}

function folder(data) {
  return {
    kind: "directory",
    async *entries() {
      for (const entry of Object.entries(data)) yield entry;
    }
  };
}

function sample() {
  return folder({
    "plugin.json": file(manifest()),
    "src": folder({ "main.js": file("export default 1;") }),
    "index.html": file("<main>Plugin</main>"),
    "styles.css": file("main {display: block;}"),
    "assets": folder({ "logo.png": file([0, 255, 32], true) })
  });
}

test("PR13 whole folder preserves nested HTML CSS JS and binary", async () => {
  const env = new VirtualTestEnvironment();
  const unit = new PluginFolderPackageUnit(env.core.omu);
  const result = await unit.snapshot(sample());
  assert.equal(result.status, 200);
  assert.equal(Object.keys(result.value.files).length, 5);
  assert.ok(Object.hasOwn(result.value.files, "src/main.js"));
  assert.ok(Object.hasOwn(result.value.files, "assets/logo.png"));
  assert.equal(unit.inspectImport(result.value).status, 200);
  assert.equal(PluginFolderPackagePolicy.inspect(
    result.value).value.manifest.uiEntry, "index.html");
  assert.equal(env.core.uru.listProviders().length, 0);
});

test("PR13 rejects traversal, oversized assets and tampered manifest", async () => {
  const env = new VirtualTestEnvironment();
  const unit = new PluginFolderPackageUnit(env.core.omu);
  assert.equal((await unit.snapshot(folder({
    "plugin.json": file(manifest()),
    "..": folder({ "malicious.js": file("bad") })
  }))).status, 400);
  assert.equal((await unit.snapshot(folder({
    "plugin.json": file(manifest()),
    "src": folder({ "main.js": file("x".repeat(2097153)) })
  }))).status, 400);
  const valid = (await unit.snapshot(sample())).value;
  valid.files["plugin.json"] = btoa("{}");
  assert.equal(unit.inspectImport(valid).status, 400);
  assert.equal(PluginFolderPackagePolicy.validPath(
    "node_modules/x.js"), false);
  assert.equal(PluginFolderPackagePolicy.validPath(
    "styles.css"), true);
});

test("PR13 optional UI entry must resolve within selected folder", async () => {
  const env = new VirtualTestEnvironment();
  const unit = new PluginFolderPackageUnit(env.core.omu);
  const invalid = folder({
    "plugin.json": file(manifest()),
    "src": folder({ "main.js": file("export default 1;") })
  });
  assert.equal((await unit.snapshot(invalid)).status, 400);
});
