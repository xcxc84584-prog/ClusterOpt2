import { test, expect } from "@playwright/test";

test("PR24 isolated Worker uses approved Session RPC through HubUnit",
  async ({ page }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const provider = {
        manifestVersion: 1,
        providerId: "pr24.browser.reverse",
        objectId: "PR24.BrowserReverse",
        provides: [{
          service: "example.pr24.reverse", action: "transform",
          version: "1.0.0",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" }
        }],
        requires: [], permissions: [],
        execution: { isolation: "worker", concurrency: "serial" }
      };
      const manifest = {
        packageVersion: 1, name: "PR24 reverse test",
        entry: "worker.js", provider,
        rpcScopes: [{ target: "UICO", action: "describe" }]
      };
      const source = `export async function transform() {
        const data = await Cluster.request("UICO", "describe", {},
          { deadlineMs: 1500 });
        let denied = false;
        try {
          await Cluster.request("UICO", "nonexistent", {},
            { deadlineMs: 1500 });
        } catch {
          denied = true;
        }
        return { objectId: data.objectId, denied };
      }`;
      const raw = JSON.stringify(manifest);
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: { "plugin.json": btoa(raw), "worker.js": btoa(source) }
      };
      const install = await linkCore.pluginHostInstaller.install(
        snapshot, { consented: true,
          approvedRpcScopes: manifest.rpcScopes });
      if (!install.ok) return { install };
      const bridge = linkCore.pluginHostInstaller.handles.get(
        provider.providerId);
      const result = await linkCore.request("ui", provider.objectId,
        "transform", {}, { origin: "user" });
      const diagnostic = linkCore.getSnapshot().logs.filter(event =>
        event.action.includes("describe") ||
        event.action.startsWith("RPC.") ||
        event.action.startsWith("Plugin.RPC.") ||
        event.source === provider.objectId).slice(0, 25).map(event => ({
          action: event.action, kind: event.kind, status: event.status,
          source: event.source
        }));
      const events = linkCore.getSnapshot().logs.filter(event =>
        event.action.startsWith("RPC.Request.") ||
        event.action.startsWith("RPC.Response."));
      const active = bridge.hostTransport?.gateway.sessions.activeCount;
      const removed = linkCore.pluginHostInstaller.uninstall(
        provider.providerId);
      return {
        install: install.status, result, events: events.length,
        active, removed: removed.status,
        diagnostic, closed: bridge.closed,
        sessionsAfter: bridge.hostTransport
      };
    });
    expect(outcome.install).toBe(201);
    expect(outcome.result.status, JSON.stringify(outcome)).toBe(200);
    expect(outcome.result.value).toEqual({
      objectId: "UICO", denied: true
    });
    expect(outcome.events).toBeGreaterThanOrEqual(2);
    expect(outcome.active).toBe(1);
    expect(outcome.removed).toBe(200);
    expect(outcome.closed).toBe(true);
    expect(outcome.sessionsAfter).toBeNull();
  });

test("PR24.7 disable/enable creates a new authenticated Worker Session",
  async ({ page }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const provider = {
        manifestVersion: 1,
        providerId: "pr24.browser.rotation",
        objectId: "PR24.BrowserRotation",
        provides: [{
          service: "example.pr24.rotation", action: "transform",
          version: "1.0.0", inputSchema: { type: "object" },
          outputSchema: { type: "object" }
        }],
        requires: [], permissions: [],
        execution: { isolation: "worker", concurrency: "serial" }
      };
      const manifest = {
        packageVersion: 1, name: "PR24 session rotation",
        entry: "worker.js", provider,
        rpcScopes: [{ target: "UICO", action: "describe" }]
      };
      const raw = JSON.stringify(manifest);
      const source = `export async function transform() {
        return { objectId:
          (await Cluster.request("UICO", "describe", {})).objectId };
      }`;
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: { "plugin.json": btoa(raw), "worker.js": btoa(source) }
      };
      const installer = linkCore.pluginHostInstaller;
      const installed = await installer.install(
        snapshot, { consented: true,
          approvedRpcScopes: manifest.rpcScopes });
      if (!installed.ok) return { installed };
      const bridge = installer.handles.get(provider.providerId);
      const original = bridge.hostTransport?.connections.get(
        bridge.port)?.sessionId;
      const first = await linkCore.request("ui", provider.objectId,
        "transform", {}, { origin: "user" });
      const disabled = installer.disable(provider.providerId);
      const suspended = bridge.hostTransport?.gateway.sessions.activeCount
        ?? -1;
      const rejected = await linkCore.request(
        "ui", provider.objectId, "transform", {},
        { origin: "user" });
      const enabled = installer.enable(provider.providerId);
      const rotated = bridge.hostTransport?.connections.get(
        bridge.port)?.sessionId;
      const second = await linkCore.request("ui", provider.objectId,
        "transform", {}, { origin: "user" });
      const removed = installer.uninstall(provider.providerId);
      return {
        installed: installed.status, first: first.value,
        disabled: disabled.status, suspended,
        rejected: rejected.status, enabled: enabled.status,
        rotated: Boolean(rotated && rotated !== original),
        second: second.value,
        diagnostic: linkCore.getSnapshot().logs.filter(event =>
          event.action.startsWith("RPC.") ||
          event.action.startsWith("Plugin.RPC.") ||
          event.source === provider.objectId).slice(0, 25).map(event => ({
            action: event.action, status: event.status,
            kind: event.kind
          })),
        removed: removed.status, closed: bridge.closed
      };
    });
    expect(outcome.installed, JSON.stringify(outcome)).toBe(201);
    expect(outcome.first, JSON.stringify(outcome))
      .toEqual({ objectId: "UICO" });
    expect(outcome.disabled).toBe(200);
    expect(outcome.suspended).toBe(0);
    expect(outcome.rejected).toBe(403);
    expect(outcome.enabled).toBe(200);
    expect(outcome.rotated).toBe(true);
    expect(outcome.second).toEqual({ objectId: "UICO" });
    expect(outcome.removed).toBe(200);
    expect(outcome.closed).toBe(true);
  });


test("PR24.45 scoped Property.Read delegates to HubUnit/EDPMU",
  async ({ page }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const rpcScopes = [{
        target: "HubUnit", action: "Property.Read",
        property: "SystemVersion"
      }];
      const provider = {
        manifestVersion: 1,
        providerId: "pr24.browser.property",
        objectId: "PR24.BrowserProperty",
        provides: [{
          service: "example.pr24.property", action: "probe",
          version: "1.0.0", inputSchema: { type: "object" },
          outputSchema: { type: "object" }
        }],
        requires: [], permissions: [],
        execution: { isolation: "worker", concurrency: "serial" }
      };
      const manifest = {
        packageVersion: 1, name: "PR24 property scope",
        entry: "worker.js", provider, rpcScopes
      };
      const source = [
        "export async function probe() {",
        "  const version = await Cluster.request('HubUnit',",
        "    'Property.Read', { name: 'SystemVersion' });",
        "  let rejected = false;",
        "  try {",
        "    await Cluster.request('HubUnit',",
        "      'Property.Read', { name: 'Language' });",
        "  } catch { rejected = true; }",
        "  return { versionType: typeof version, rejected };",
        "}"
      ].join("\n");
      const raw = JSON.stringify(manifest);
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: {
          "plugin.json": btoa(raw), "worker.js": btoa(source)
        }
      };
      const installer = linkCore.pluginHostInstaller;
      const installed = await installer.install(snapshot, {
        consented: true, approvedRpcScopes: rpcScopes
      });
      if (!installed.ok) return { installed };
      try {
        const result = await linkCore.request("ui",
          provider.objectId, "probe", {}, { origin: "user" });
        return { installed: installed.status, result };
      } finally {
        installer.uninstall(provider.providerId);
      }
    });
    expect(outcome.installed, JSON.stringify(outcome)).toBe(201);
    expect(outcome.result.status, JSON.stringify(outcome)).toBe(200);
    expect(outcome.result.value).toEqual({
      versionType: "string", rejected: true
    });
  });


test("PR24.49 real Worker revocation survives Session rekey",
  async ({ page }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const revokedScope = { target: "UICO", action: "describe" };
      const languageScope = {
        target: "HubUnit", action: "Property.Read", property: "Language"
      };
      const rpcScopes = [revokedScope, languageScope];
      const provider = {
        manifestVersion: 1, providerId: "pr24.browser.revoke",
        objectId: "PR24.BrowserRevoke",
        provides: [{
          service: "example.pr24.revoke", action: "probe",
          version: "1.0.0", inputSchema: { type: "object" },
          outputSchema: { type: "object" }
        }],
        requires: [], permissions: [],
        execution: { isolation: "worker", concurrency: "serial" }
      };
      const manifest = {
        packageVersion: 1, name: "PR24 runtime revoke",
        entry: "worker.js", provider, rpcScopes
      };
      const source = [
        "export async function probe() {",
        "  let blocked = false;",
        "  try { await Cluster.request('UICO', 'describe', {}); }",
        "  catch { blocked = true; }",
        "  const language = await Cluster.request('HubUnit',",
        "    'Property.Read', { name: 'Language' });",
        "  return { blocked, language };",
        "}"
      ].join("\n");
      const raw = JSON.stringify(manifest);
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: { "plugin.json": btoa(raw), "worker.js": btoa(source) }
      };
      const installer = linkCore.pluginHostInstaller;
      const installed = await installer.install(snapshot, {
        consented: true, approvedRpcScopes: rpcScopes
      });
      if (!installed.ok) return { installed };
      try {
        const invoke = () => linkCore.request("ui",
          provider.objectId, "probe", {}, { origin: "user" });
        const before = await invoke();
        const revoked = installer.revokeRpcScope(
          provider.providerId, revokedScope);
        const after = await invoke();
        const disabled = installer.disable(provider.providerId);
        const enabled = installer.enable(provider.providerId);
        const afterRekey = await invoke();
        const audit = linkCore.getSnapshot().logs.some(event =>
          event.action === "RPC.ScopeRevoked" &&
          event.status === 200);
        const rejected = linkCore.getSnapshot().logs.some(event =>
          event.action === "RPC.ScopeRejected" &&
          event.status === 403);
        return {
          installed: installed.status, before, revoked, after,
          disabled: disabled.status, enabled: enabled.status,
          afterRekey, audit, rejected,
          remaining: installer.listRpcScopes(provider.providerId)
        };
      } finally {
        installer.uninstall(provider.providerId);
      }
    });
    expect(outcome.installed, JSON.stringify(outcome)).toBe(201);
    expect(outcome.before.status, JSON.stringify(outcome)).toBe(200);
    expect(outcome.before.value.blocked).toBe(false);
    expect(outcome.before.value.language).toBe("zh-Hant");
    expect(outcome.revoked.status).toBe(200);
    expect(outcome.after.status, JSON.stringify(outcome)).toBe(200);
    expect(outcome.after.value).toEqual({
      blocked: true, language: "zh-Hant"
    });
    expect(outcome.disabled).toBe(200);
    expect(outcome.enabled).toBe(200);
    expect(outcome.afterRekey.value).toEqual({
      blocked: true, language: "zh-Hant"
    });
    expect(outcome.audit).toBe(true);
    expect(outcome.rejected).toBe(true);
    expect(outcome.remaining).toEqual([{
      target: "HubUnit", action: "Property.Read", property: "Language"
    }]);
  });
