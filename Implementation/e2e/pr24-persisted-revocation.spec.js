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

test("PR24.47 explicit regrant rekeys Worker and removes durable denial",
  async ({ page }) => {
    const data = fixture();
    await page.goto("/");
    const result = await page.evaluate(async ({ snapshot, rpcScopes,
      provider }) => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const installer = linkCore.pluginHostInstaller;
      const installed = await installer.install(snapshot, {
        consented: true, approvedRpcScopes: rpcScopes
      });
      if (!installed.ok) return { installed };
      const bridge = installer.handles.get(provider.providerId);
      try {
        const original = bridge.hostTransport.connections.get(
          bridge.port).sessionId;
        const denied = await installer.revokeRpcScopePersisted(
          provider.providerId, rpcScopes[0]);
        const noConsent = await installer.reapproveRpcScope(
          provider.providerId, rpcScopes[0]);
        const before = await linkCore.request("ui",
          provider.objectId, "probe", {}, { origin: "user" });
        const reapproved = await installer.reapproveRpcScope(
          provider.providerId, rpcScopes[0], { consented: true });
        const rotated = bridge.hostTransport.connections.get(
          bridge.port).sessionId !== original;
        const after = await linkCore.request("ui",
          provider.objectId, "probe", {}, { origin: "user" });
        const persisted = await installer.listRevokedRpcScopes(
          provider.providerId);
        return {
          installed: installed.status, denied: denied.status,
          noConsent: noConsent.status,
          before: before.value, reapproved: reapproved.status,
          rotated, after, persisted: persisted.value
        };
      } finally {
        installer.uninstall(provider.providerId);
      }
    }, data);
    expect(result.installed, JSON.stringify(result)).toBe(201);
    expect(result.denied).toBe(200);
    expect(result.noConsent).toBe(403);
    expect(result.before).toEqual({
      denied: true, language: "zh-Hant"
    });
    expect(result.reapproved, JSON.stringify(result)).toBe(200);
    expect(result.rotated).toBe(true);
    expect(result.after.status, JSON.stringify(result)).toBe(200);
    expect(result.after.value).toEqual({
      denied: false, language: "zh-Hant"
    });
    expect(result.persisted).toEqual([]);
  });

test("PR24.48 same-origin tab receives durable deny, never a grant",
  async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    const data = fixture();
    try {
      await Promise.all([a.goto("/"), b.goto("/")]);
      const install = page => page.evaluate(async ({
        snapshot, rpcScopes }) => {
        const { linkCore } = await import(
          "/Implementation/LinkCore/LinkCore.js");
        return linkCore.pluginHostInstaller.install(snapshot, {
          consented: true, approvedRpcScopes: rpcScopes
        });
      }, data);
      const [first, second] = await Promise.all([
        install(a), install(b)
      ]);
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      const remote = await b.evaluate(async providerId => {
        const { linkCore } = await import(
          "/Implementation/LinkCore/LinkCore.js");
        return linkCore.pluginHostInstaller.listRpcScopes(
          providerId).length;
      }, data.provider.providerId);
      expect(remote).toBe(2);
      const revoke = await a.evaluate(async ({
        provider, rpcScopes }) => {
        const { linkCore } = await import(
          "/Implementation/LinkCore/LinkCore.js");
        return linkCore.pluginHostInstaller.revokeRpcScopePersisted(
          provider.providerId, rpcScopes[0]);
      }, data);
      expect(revoke.status).toBe(200);
      await b.waitForFunction(async providerId => {
        const { linkCore } = await import(
          "/Implementation/LinkCore/LinkCore.js");
        return linkCore.pluginHostInstaller.listRpcScopes(
          providerId).length === 1;
      }, data.provider.providerId, { timeout: 4000 });
      const answer = await b.evaluate(async provider => {
        const { linkCore } = await import(
          "/Implementation/LinkCore/LinkCore.js");
        return linkCore.request("ui", provider.objectId, "probe",
          {}, { origin: "user" });
      }, data.provider);
      expect(answer.status).toBe(200);
      expect(answer.value).toEqual({
        denied: true, language: "zh-Hant"
      });
    } finally {
      await Promise.all([a, b].map(async page => {
        await page.evaluate(async providerId => {
          const { linkCore } = await import(
            "/Implementation/LinkCore/LinkCore.js");
          linkCore.pluginHostInstaller.uninstall(providerId);
        }, data.provider.providerId).catch(() => {});
        await page.close();
      }));
    }
  });
