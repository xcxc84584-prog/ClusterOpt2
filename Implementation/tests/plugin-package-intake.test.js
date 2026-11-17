import test from "node:test";
import assert from "node:assert/strict";
import { PluginLocalPackageUnit } from
  "../LinkCore/PluginLocalPackageUnit.js";
import { PluginRPCContractPolicy as RPC } from
  "../property/PluginRPCContractPolicy.js";
import { PluginCapabilityReviewPolicy as ACL } from
  "../property/PluginCapabilityReviewPolicy.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function fixture() {
  return {
    packageVersion: 1, name: "User plugin", entry: "worker.js",
    provider: {
      manifestVersion: 1, providerId: "example.lex",
      objectId: "Example.Lex", provides: [{
        service: "editor.syntax.tokens", action: "tokenize",
        version: "1.0.0", inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }],
      requires: [], permissions: ["document.slice.read"],
      execution: { isolation: "worker", concurrency: "serial" }
    }
  };
}

function fakeDirectory(files) {
  return {
    kind: "directory",
    async getFileHandle(name) {
      if (!Object.hasOwn(files, name)) throw Error("Missing file");
      return {
        async getFile() {
          return { size: new TextEncoder().encode(files[name]).length,
            async text() { return files[name]; } };
        }
      };
    },
    async getDirectoryHandle() {
      throw Error("No nested directory");
    }
  };
}

test("PR13.2 stages local package without executing or registering", async () => {
  const env = new VirtualTestEnvironment();
  const stage = new PluginLocalPackageUnit(env.core.omu);
  const directory = fakeDirectory({
    "plugin.json": JSON.stringify(fixture()),
    "worker.js": "self.onmessage = () => {};"
  });
  const result = await stage.stageDirectory(directory);
  assert.equal(result.status, 200);
  assert.equal(result.value.state, "staged");
  assert.equal(result.value.source.includes("onmessage"), true);
  assert.equal(env.core.uru.listProviders().length, 0);
  assert.ok(env.log().some(entry =>
    entry.action === "Plugin.Package.Stage" && entry.status === 200));
});

test("PR13.2 rejects absent, oversize and malformed package", async () => {
  const env = new VirtualTestEnvironment();
  const stage = new PluginLocalPackageUnit(env.core.omu);
  assert.equal((await stage.stageDirectory(null)).status, 400);
  assert.equal((await stage.stageDirectory(
    fakeDirectory({ "plugin.json": "{}" }))).status, 400);
  assert.equal((await stage.stageDirectory(fakeDirectory({
    "plugin.json": JSON.stringify(fixture())
  }))).status, 400);
  assert.equal((await stage.stageDirectory(fakeDirectory({
    "plugin.json": JSON.stringify(fixture()),
    "worker.js": "x".repeat(1048577)
  }))).status, 413);
  assert.equal(env.core.uru.listProviders().length, 0);
  assert.ok(env.log().some(entry =>
    entry.action === "Plugin.Package.Stage" && entry.kind === "EHU"));
});

test("PR13.3 RPC accepts declared action and rejects impersonation", () => {
  const manifest = fixture().provider;
  const req = {
    kind: "invoke", id: 1, service: "editor.syntax.tokens",
    action: "tokenize", payload: { text: "x" }
  };
  assert.equal(RPC.request(req, manifest).status, 200);
  assert.equal(RPC.request({ ...req, action: "privileged" },
    manifest).status, 403);
  assert.equal(RPC.request({ ...req, id: -1 }, manifest).status, 400);
  assert.equal(RPC.request({ ...req, extra: true },
    manifest).status, 400);
  assert.equal(RPC.response({
    kind: "response", id: 1, ok: true, value: { tokens: [] }
  }, 1).status, 200);
  assert.equal(RPC.response({
    kind: "response", id: 2, ok: true, value: {}
  }, 1).status, 502);
  assert.equal(RPC.response({
    kind: "response", id: 1, ok: false, status: 403
  }, 1).status, 403);
});

test("PR13.4 requires explicit review and always forbids core", () => {
  const manifest = fixture().provider;
  assert.equal(ACL.inspect(manifest).status, 403);
  assert.equal(ACL.inspect(manifest, ["document.slice.read"]).status,
    200);
  assert.equal(ACL.inspect(manifest, ["network.request"]).status, 400);
  assert.equal(ACL.inspect(manifest, ["document.slice.read",
    "document.slice.read"]).status, 400);
  assert.equal(ACL.inspect({ ...manifest,
    permissions: ["storage.write"] }, ["storage.write"]).status, 403);
});
