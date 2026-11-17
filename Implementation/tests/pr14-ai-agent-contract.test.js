import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PluginPackageManifestPolicy } from
  "../property/PluginPackageManifestPolicy.js";
import { PluginFolderPackagePolicy } from
  "../property/PluginFolderPackagePolicy.js";
import { PluginCapabilityReviewPolicy } from
  "../property/PluginCapabilityReviewPolicy.js";
import { PluginHostInstallUnit } from
  "../LinkCore/PluginHostInstallUnit.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

const directory = new URL("../plugins/ai-agent-mcp/", import.meta.url);

function asset(name) {
  return readFileSync(new URL(name, directory), "utf8");
}

function snapshot(manifestText = asset("plugin.json")) {
  return {
    format: "cluster-plugin-folder",
    formatVersion: 1,
    manifestText,
    files: {
      "plugin.json": Buffer.from(manifestText).toString("base64"),
      "worker.js": Buffer.from(asset("worker.js")).toString("base64"),
      "README.md": Buffer.from(asset("README.md")).toString("base64"),
      "index.html": Buffer.from(asset("index.html")).toString("base64"),
      "locales/en.json": Buffer.from(asset("locales/en.json"))
        .toString("base64"),
      "locales/zh-Hant.json": Buffer.from(
        asset("locales/zh-Hant.json")).toString("base64")
    }
  };
}

test("PR14.2 manifest passes both existing package contracts", () => {
  const parsed = PluginPackageManifestPolicy.validate(
    asset("plugin.json"));
  assert.equal(parsed.status, 200);
  assert.equal(PluginFolderPackagePolicy.inspect(
    snapshot()).status, 200);
  assert.equal(parsed.value.name, "AI AGENT MCP(ChatGPT)");
  assert.equal(parsed.value.provider.objectId, "AIAgentMCP");
  assert.deepEqual(parsed.value.provider.permissions, ["network.request"]);
  assert.deepEqual(parsed.value.provider.requires, []);
  assert.equal(parsed.value.uiEntry, "index.html");
  assert.equal(parsed.value.provider.execution.isolation, "worker");
  assert.deepEqual(parsed.value.provider.provides.map(
    service => service.action), ["getStatus", "describe"]);
});

test("PR14.2 worker exports match declared Hub actions", async () => {
  const manifest = JSON.parse(asset("plugin.json"));
  const module = await import(
    "../plugins/ai-agent-mcp/worker.js");
  const actions = manifest.provider.provides.map(
    service => service.action);
  assert.deepEqual(
    Object.keys(module).sort(), [...actions].sort());
  assert.deepEqual(module.getStatus(), {
    phase: "contract-only",
    connected: false,
    privileged: false
  });
  assert.deepEqual(module.describe(), {
    contractVersion: 1,
    pluginName: "AI AGENT MCP(ChatGPT)",
    capabilities: ["status.read", "contract.describe"]
  });
});

test("PR14.2 denies install without explicit consent", async () => {
  const env = new VirtualTestEnvironment();
  let started = false;
  const installer = new PluginHostInstallUnit(
    env.core, null, () => ({
      async start() {
        started = true;
        return { ok: true, status: 200 };
      },
      terminate() {}
    }));
  assert.equal((await installer.install(snapshot(), {
    approvedPermissions: ["network.request"]
  })).status, 403);
  assert.equal(started, false);
  assert.equal(env.core.uru.listProviders().length, 0);
  assert.ok(env.log().some(item =>
    item.kind === "EHU" &&
    item.action === "Plugin.Install.ConsentRequired"));
});

test("PR14.2 Hub routes safe requests and audits denied requests",
  async () => {
    const env = new VirtualTestEnvironment();
    const module = await import(
      "../plugins/ai-agent-mcp/worker.js");
    const installer = new PluginHostInstallUnit(
      env.core, null, () => ({
        async start() { return { ok: true, status: 200 }; },
        async invoke(_service, action, payload) {
          if (Object.keys(payload).length) {
            return { ok: false, status: 400 };
          }
          return {
            ok: true, status: 200, value: module[action]()
          };
        },
        terminate() {}
      }));
    const result = await installer.install(snapshot(), {
      consented: true, approvedPermissions: ["network.request"]
    });
    assert.equal(result.status, 201);
    assert.equal(env.core.uru.listProviders().length, 1);
    const status = await env.core.request(
      "VTE", "AIAgentMCP", "getStatus", {},
      { origin: "user" });
    assert.equal(status.status, 200);
    assert.equal(status.value.phase, "contract-only");
    const contract = await env.core.request(
      "VTE", "AIAgentMCP", "describe", {},
      { origin: "user" });
    assert.equal(contract.status, 200);
    assert.equal(contract.value.contractVersion, 1);
    const malformed = await env.core.request(
      "VTE", "AIAgentMCP", "getStatus", "bad input",
      { origin: "user" });
    assert.equal(malformed.status, 400);
    const forbidden = await env.core.request(
      "VTE", "AIAgentMCP", "powershell", {},
      { origin: "user" });
    assert.ok(forbidden.status >= 400);
    assert.ok(env.log().some(item => item.kind === "EHU"));
    assert.equal(installer.uninstall(
      "cluster.ai-agent-mcp").status, 200);
    assert.equal(env.core.uru.listProviders().length, 0);
  });

test("PR14.2 core capability cannot be self-approved", async () => {
  const env = new VirtualTestEnvironment();
  const changed = JSON.parse(asset("plugin.json"));
  changed.provider.permissions = ["route.configure"];
  const text = JSON.stringify(changed);
  assert.equal(PluginPackageManifestPolicy.validate(text).status, 200);
  assert.equal(PluginFolderPackagePolicy.inspect(
    snapshot(text)).status, 200);
  assert.equal(PluginCapabilityReviewPolicy.inspect(
    changed.provider, ["route.configure"]).status, 403);
  let booted = false;
  const installer = new PluginHostInstallUnit(
    env.core, null, () => ({
      async start() {
        booted = true;
        return { ok: true, status: 200 };
      },
      terminate() {}
    }));
  const denied = await installer.install(snapshot(text), {
    consented: true,
    approvedPermissions: ["route.configure"]
  });
  assert.equal(denied.status, 403);
  assert.equal(booted, false);
  assert.equal(env.core.uru.listProviders().length, 0);
  assert.ok(env.log().some(item =>
    item.kind === "EHU" && item.status === 403));
});

test("PR14.2 rejects undeclared exports and unsafe package paths",
  () => {
    const changed = JSON.parse(asset("plugin.json"));
    changed.entry = "../worker.js";
    assert.equal(PluginPackageManifestPolicy.validate(
      JSON.stringify(changed)).status, 400);
    assert.match(asset("worker.js"), /contract-only/);
    assert.doesNotMatch(asset("worker.js"),
      /(?:fetch\s*\(|new\s+WebSocket\s*\(|localStorage)/);
  });
