import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { PluginHostInstallUnit } from
  "../LinkCore/PluginHostInstallUnit.js";

function specimen(permissions = []) {
  const manifest = {
    packageVersion: 1,
    name: "Isolated example",
    entry: "worker.js",
    provider: {
      manifestVersion: 1,
      providerId: "author.sandbox",
      objectId: "Author.Sandbox",
      provides: [{
        service: "example.text.transform",
        action: "transform",
        version: "1.0.0",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }],
      requires: [],
      permissions,
      execution: { isolation: "worker", concurrency: "serial" }
    }
  };
  const text = JSON.stringify(manifest);
  return {
    format: "cluster-plugin-folder",
    formatVersion: 1,
    manifestText: text,
    files: {
      "plugin.json": btoa(text),
      "worker.js": btoa("export function transform() { return {}; }")
    }
  };
}

function harness() {
  const env = new VirtualTestEnvironment();
  let invoked = 0;
  let terminated = false;
  let booted = false;
  const installer = new PluginHostInstallUnit(env.core, null, () => ({
    async start() {
      booted = true;
      return { ok: true, status: 200 };
    },
    async invoke(_service, _action, payload) {
      invoked++;
      return { ok: true, status: 200, value: { result: payload.text } };
    },
    terminate() { terminated = true; }
  }));
  return {
    env, installer,
    get invoked() { return invoked; },
    get terminated() { return terminated; },
    get booted() { return booted; }
  };
}

test("PR13.2 consent required before code bootstrap and URU identity", async () => {
  const h = harness();
  const result = await h.installer.install(specimen());
  assert.equal(result.status, 403);
  assert.equal(h.booted, false);
  assert.equal(h.env.core.uru.listProviders().length, 0);
  assert.ok(h.env.log().some(entry =>
    entry.action === "Plugin.Install.ConsentRequired" &&
    entry.kind === "EHU"));
});

test("PR13.3 installs via Hub/URU and returns symmetric RPC", async () => {
  const h = harness();
  const installed = await h.installer.install(specimen(), {
    consented: true, approvedPermissions: []
  });
  assert.equal(installed.status, 201);
  assert.equal(h.env.core.uru.listProviders().length, 1);
  const result = await h.env.core.request(
    "VTE", "Author.Sandbox", "transform",
    { text: "hello" }, { origin: "user" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.value, { result: "hello" });
  assert.equal(h.invoked, 1);
  assert.ok(h.env.log().some(entry =>
    entry.action === "Plugin.Invoke.transform" && entry.status === 200));
  const removed = h.installer.uninstall("author.sandbox");
  assert.equal(removed.status, 200);
  assert.equal(h.env.core.uru.listProviders().length, 0);
  assert.equal(h.terminated, true);
});

test("PR13.4 per-call permission revocation denies running plugin", async () => {
  const h = harness();
  const snapshot = specimen(["document.slice.read"]);
  assert.equal((await h.installer.install(snapshot, {
    consented: true
  })).status, 403);
  assert.equal(h.booted, false);
  assert.equal((await h.installer.install(snapshot, {
    consented: true,
    approvedPermissions: ["document.slice.read"]
  })).status, 201);
  assert.equal((await h.env.core.request(
    "VTE", "Author.Sandbox", "transform",
    { text: "ok" }, { origin: "user" }
  )).ok, true);
  assert.equal(h.invoked, 1);
  assert.equal(h.env.core.revokePluginPermission(
    "Author.Sandbox", "author.sandbox", "document.slice.read").ok, true);
  const denied = await h.env.core.request(
    "VTE", "Author.Sandbox", "transform",
    { text: "ok" }, { origin: "user" });
  assert.equal(denied.status, 403);
  assert.equal(h.invoked, 1);
  assert.ok(h.env.log().some(entry =>
    entry.kind === "EHU" &&
    entry.action === "Plugin.Invoke.transform" &&
    entry.status === 403));
});

test("PR13.6 dependency check prevents broken activation", async () => {
  const h = harness();
  const snapshot = specimen();
  const manifest = JSON.parse(snapshot.manifestText);
  manifest.provider.requires = ["service.missing"];
  const raw = JSON.stringify(manifest);
  snapshot.manifestText = raw;
  snapshot.files["plugin.json"] = btoa(raw);
  const rejected = await h.installer.install(snapshot, {
    consented: true
  });
  assert.equal(rejected.status, 409);
  assert.equal(h.booted, false);
  assert.equal(h.env.core.uru.listProviders().length, 0);
});

test("PR13.4 rejects mismatched Request and Response schemas", async () => {
  const h = harness();
  assert.equal((await h.installer.install(specimen(), {
    consented: true
  })).status, 201);
  const badInput = await h.env.core.request(
    "VTE", "Author.Sandbox", "transform", "not an object",
    { origin: "user" });
  assert.equal(badInput.status, 400);
  assert.equal(h.invoked, 0);
  const bridge = h.installer.handles.get("author.sandbox");
  bridge.invoke = async () => ({
    ok: true, status: 200, value: "invalid output"
  });
  const badOutput = await h.env.core.request(
    "VTE", "Author.Sandbox", "transform", {},
    { origin: "user" });
  assert.equal(badOutput.status, 502);
  assert.ok(h.env.log().some(entry => entry.kind === "EHU" &&
    entry.action === "Plugin.Invoke.transform" &&
    entry.status === 502));
});
