import { test, expect } from "@playwright/test";

function makeFixture(providerId, objectId, action, source, rpcScopes) {
  const manifest = {
    packageVersion: 1, name: "PR24 upgrade isolation",
    entry: "worker.js", rpcScopes,
    provider: {
      manifestVersion: 1, providerId, objectId,
      provides: [{
        service: "example.pr24." + action, action,
        version: "1.0.0",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }],
      requires: [], permissions: [],
      execution: { isolation: "worker", concurrency: "serial" }
    }
  };
  const raw = JSON.stringify(manifest);
  return {
    format: "cluster-plugin-folder", formatVersion: 1,
    manifestText: raw,
    files: {
      "plugin.json": Buffer.from(raw, "utf8").toString("base64"),
      "worker.js": Buffer.from(source, "utf8").toString("base64")
    }
  };
}

test("PR24.76 upgrade cannot tear down pending reverse Host work",
  async ({ page }) => {
    await page.goto("/");
    const rpcScopes = [{
      target: "PR24.PendingHost", action: "linger"
    }];
    const source = [
      "export function probe(payload) {",
      "  if (payload.start) {",
      "    void Cluster.request('PR24.PendingHost', 'linger', {},",
      "      { deadlineMs: 3500 }).catch(() => {});",
      "  }",
      "  return { active: true };",
      "}"
    ].join("\n");
    const data = {
      snapshot: makeFixture("pr24.browser.pending-upgrade",
        "PR24.BrowserPendingUpgrade", "probe", source, rpcScopes),
      rpcScopes
    };
    const result = await page.evaluate(async ({ snapshot, rpcScopes }) => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const manifest = JSON.parse(snapshot.manifestText);
      const provider = manifest.provider;
      let finishHost;
      let markStarted;
      const started = new Promise(resolve => { markStarted = resolve; });
      const target = {
        id: "PR24.PendingHost", strictOCDA: true,
        authorization: { default: "Public" },
        ocda: {
          EHU: [], Log: [], Request: ["linger"], Response: [],
          UserAPI: ["linger"], AgentAPI: [], Property: [],
          Program: "PR24UpgradeTestHost"
        },
        receive: () => new Promise(resolve => {
          finishHost = resolve;
          markStarted();
        })
      };
      if (!linkCore.register(target)) return { registration: false };
      const installer = linkCore.pluginHostInstaller;
      const installed = await installer.install(snapshot, {
        consented: true, approvedRpcScopes: rpcScopes
      });
      if (!installed.ok) return { installed };
      const bridge = installer.handles.get(provider.providerId);
      try {
        const triggered = await linkCore.request(
          "ui", provider.objectId, "probe", { start: true },
          { origin: "user" });
        const sawHostCall = await Promise.race([
          started.then(() => true),
          new Promise(resolve => setTimeout(() => resolve(false), 1800))
        ]);
        if (!sawHostCall) return { triggered, sawHostCall };
        const reverse = bridge.pendingHostRequestCount();
        const forward = linkCore.hub.providerInflight.get(
          provider.providerId) ?? 0;
        const denied = await installer.upgrade(provider.providerId,
          snapshot, { consented: true, approvedRpcScopes: rpcScopes });
        const sameBridge = installer.handles.get(
          provider.providerId) === bridge;
        const activeProvider =
          linkCore.uru.getProvider(provider.providerId) !== null;
        finishHost({ ok: true });
        await new Promise(resolve => setTimeout(resolve, 30));
        const after = await linkCore.request(
          "ui", provider.objectId, "probe", { start: false },
          { origin: "user" });
        return {
          triggered: triggered.status, sawHostCall,
          reverse, forward, denied: denied.status,
          sameBridge, activeProvider, closed: bridge.closed,
          after: after.status, pending: bridge.pendingHostRequestCount()
        };
      } finally {
        if (finishHost) finishHost({});
        installer.uninstall(provider.providerId);
        linkCore.unregister(target.id);
      }
    }, data);
    expect(result.triggered, JSON.stringify(result)).toBe(200);
    expect(result.sawHostCall).toBe(true);
    expect(result.reverse).toBeGreaterThanOrEqual(1);
    expect(result.forward).toBe(0);
    expect(result.denied).toBe(409);
    expect(result.sameBridge).toBe(true);
    expect(result.activeProvider).toBe(true);
    expect(result.closed).toBe(false);
    expect(result.after).toBe(200);
    expect(result.pending).toBe(0);
  });

test("PR24.77 failed Worker upgrade restores original Session and UI",
  async ({ page }) => {
    await page.goto("/");
    const rpcScopes = [{ target: "UICO", action: "describe" }];
    const original = makeFixture(
      "pr24.browser.rollback", "PR24.BrowserRollback",
      "probe", [
        "export async function probe() {",
        "  const value = await Cluster.request('UICO', 'describe', {});",
        "  return { objectId: value.objectId };",
        "}"
      ].join("\n"), rpcScopes);
    const invalid = structuredClone(original);
    invalid.files["worker.js"] = Buffer.from(
      "throw new Error('bad plugin entry');", "utf8").toString("base64");
    const outcome = await page.evaluate(async ({ original, invalid,
      rpcScopes }) => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const manifest = JSON.parse(original.manifestText);
      const provider = manifest.provider;
      const installer = linkCore.pluginHostInstaller;
      const approved = {
        consented: true, approvedRpcScopes: rpcScopes
      };
      const installed = await installer.install(original, approved);
      if (!installed.ok) return { installed };
      const bridge = installer.handles.get(provider.providerId);
      try {
        const oldSession = bridge.hostTransport.connections.get(
          bridge.port)?.sessionId;
        const before = await linkCore.request(
          "ui", provider.objectId, "probe", {},
          { origin: "user" });
        const upgraded = await installer.upgrade(
          provider.providerId, invalid, approved);
        const restored = installer.handles.get(
          provider.providerId) === bridge;
        const newSession = bridge.hostTransport.connections.get(
          bridge.port)?.sessionId;
        await new Promise(resolve => setTimeout(resolve, 40));
        const after = await linkCore.request(
          "ui", provider.objectId, "probe", {},
          { origin: "user" });
        return {
          installed: installed.status,
          before, after, upgraded: upgraded.status,
          restored, rotated: Boolean(newSession &&
            oldSession !== newSession),
          closed: bridge.closed,
          providerPresent: Boolean(linkCore.uru.getProvider(
            provider.providerId))
        };
      } finally {
        installer.uninstall(provider.providerId);
      }
    }, { original, invalid, rpcScopes });
    expect(outcome.installed, JSON.stringify(outcome)).toBe(201);
    expect(outcome.before.value).toEqual({
      objectId: "UICO"
    });
    expect(outcome.upgraded).toBeGreaterThanOrEqual(400);
    expect(outcome.restored).toBe(true);
    expect(outcome.rotated).toBe(true);
    expect(outcome.closed).toBe(false);
    expect(outcome.providerPresent).toBe(true);
    expect(outcome.after.status, JSON.stringify(outcome)).toBe(200);
    expect(outcome.after.value).toEqual({ objectId: "UICO" });
  });

test("PR24.18/83 unexpected Worker crash disables Provider and cleans Ports",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const source = [
        "export function probe() { return { active: true }; }",
        "setTimeout(() => { throw Error('worker crash fixture'); }, 120);"
      ].join("\n");
      const snapshot = (() => {
        const manifest = {
          packageVersion: 1, name: "Crash fixture",
          entry: "worker.js",
          provider: {
            manifestVersion: 1,
            providerId: "example.sdk.crash",
            objectId: "SDK.Crash",
            provides: [{
              service: "example.sdk.crash", action: "probe",
              version: "1.0.0",
              inputSchema: { type: "object" },
              outputSchema: { type: "object" }
            }],
            requires: [], permissions: [],
            execution: { isolation: "worker", concurrency: "serial" }
          }
        };
        const raw = JSON.stringify(manifest);
        return {
          format: "cluster-plugin-folder", formatVersion: 1,
          manifestText: raw,
          files: {
            "plugin.json": btoa(raw),
            "worker.js": btoa(source)
          }
        };
      })();
      const host = linkCore.pluginHostInstaller;
      const install = await host.install(snapshot, { consented: true });
      if (!install.ok) return { install };
      const bridge = host.handles.get("example.sdk.crash");
      const transport = bridge.hostTransport;
      try {
        for (let i = 0; i < 50 && !bridge.closed; i++) {
          await new Promise(resolve => setTimeout(resolve, 15));
        }
        return {
          install: install.status, closed: bridge.closed,
          disabled: linkCore.uru.disabledProviders.has(
            "example.sdk.crash"),
          sessions: transport.gateway.sessions.activeCount,
          ports: transport.connections.size,
          present: Boolean(linkCore.uru.getProvider(
            "example.sdk.crash")),
          faultAudit: linkCore.getSnapshot().logs.some(event =>
            event.action.startsWith(
              "Plugin.Install.WorkerFault.") &&
            event.kind === "EHU")
        };
      } finally {
        host.uninstall("example.sdk.crash");
      }
    });
    expect(result.install, JSON.stringify(result)).toBe(201);
    expect(result.closed).toBe(true);
    expect(result.disabled).toBe(true);
    expect(result.sessions).toBe(0);
    expect(result.ports).toBe(0);
    expect(result.present).toBe(true);
    expect(result.faultAudit).toBe(true);
  });
