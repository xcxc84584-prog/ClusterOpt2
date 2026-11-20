import { test, expect } from "@playwright/test";

function fixture() {
  const rpcScopes = [{
    target: "UICO", action: "describe"
  }, {
    target: "HubUnit", action: "Property.Read", property: "Language"
  }];
  const provider = {
    manifestVersion: 1, providerId: "pr24.browser.persist-deny",
    objectId: "PR24.BrowserPersistDeny",
    provides: [{
      service: "example.pr24.persist-deny", action: "probe",
      version: "1.0.0", inputSchema: { type: "object" },
      outputSchema: { type: "object" }
    }],
    requires: [], permissions: [],
    execution: { isolation: "worker", concurrency: "serial" }
  };
  const manifest = {
    packageVersion: 1, name: "PR24 durable scope deny",
    entry: "worker.js", rpcScopes, provider
  };
  const raw = JSON.stringify(manifest);
  const source = [
    "export async function probe() {",
    "  let denied = false;",
    "  try { await Cluster.request('UICO', 'describe', {}); }",
    "  catch { denied = true; }",
    "  const language = await Cluster.request('HubUnit',",
    "    'Property.Read', { name: 'Language' });",
    "  return { denied, language };",
    "}"
  ].join("\n");
  return {
    rpcScopes, provider,
    snapshot: {
      format: "cluster-plugin-folder", formatVersion: 1,
      manifestText: raw,
      files: {
        "plugin.json": Buffer.from(raw, "utf8").toString("base64"),
        "worker.js": Buffer.from(source, "utf8").toString("base64")
      }
    }
  };
}

test("PR24.46 IndexedDB denial persists across browser reload",
  async ({ page }) => {
    const data = fixture();
    await page.goto("/");
    const first = await page.evaluate(async ({ snapshot, rpcScopes,
      provider }) => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const host = linkCore.pluginHostInstaller;
      const grant = {
        consented: true, approvedRpcScopes: rpcScopes
      };
      const install = await host.install(snapshot, grant);
      if (!install.ok) return { install };
      try {
        const call = () => linkCore.request(
          "ui", provider.objectId, "probe", {}, { origin: "user" });
        const before = await call();
        const revoked = await host.revokeRpcScopePersisted(
          provider.providerId, rpcScopes[0]);
        const after = await call();
        return {
          install: install.status, before, revoked,
          after, remaining: host.listRpcScopes(provider.providerId)
        };
      } finally {
        host.uninstall(provider.providerId);
      }
    }, data);
    expect(first.install, JSON.stringify(first)).toBe(201);
    expect(first.before.status).toBe(200);
    expect(first.before.value).toEqual({
      denied: false, language: "zh-Hant"
    });
    expect(first.revoked.status).toBe(200);
    expect(first.after.value).toEqual({
      denied: true, language: "zh-Hant"
    });
    expect(first.remaining).toEqual([data.rpcScopes[1]]);

    await page.reload();
    const fresh = await page.evaluate(async ({ snapshot, rpcScopes,
      provider }) => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const host = linkCore.pluginHostInstaller;
      // Blanket approved scopes are not a separate regrant ceremony.
      const install = await host.install(snapshot, {
        consented: true, approvedRpcScopes: rpcScopes
      });
      if (!install.ok) return { install };
      try {
        const response = await linkCore.request(
          "ui", provider.objectId, "probe", {}, { origin: "user" });
        const evidence = linkCore.getSnapshot().logs.some(event =>
          event.action === "Plugin.Install.RPCPersistedDenyApplied");
        return {
          install: install.status, response, evidence,
          remaining: host.listRpcScopes(provider.providerId)
        };
      } finally {
        host.uninstall(provider.providerId);
      }
    }, data);
    expect(fresh.install, JSON.stringify(fresh)).toBe(201);
    expect(fresh.response.status, JSON.stringify(fresh)).toBe(200);
    expect(fresh.response.value).toEqual({
      denied: true, language: "zh-Hant"
    });
    expect(fresh.remaining).toEqual([data.rpcScopes[1]]);
    expect(fresh.evidence).toBe(true);
  });
