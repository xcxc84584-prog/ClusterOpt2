import { test, expect } from "@playwright/test";

function manifest(providerId = "user.sandbox-smoke") {
  return {
    packageVersion: 1, name: "Sandbox smoke", entry: "entry.js",
    provider: {
      manifestVersion: 1, providerId,
      objectId: "User.SandboxSmoke",
      provides: [{
        service: "example.sandbox.smoke", action: "transform",
        version: "1.0.0", inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }],
      requires: [], permissions: [],
      execution: { isolation: "worker", concurrency: "serial" }
    }
  };
}

test("PR13 isolated module denies parent DOM, routes through HubUnit",
  async ({ page }) => {
    await page.goto("/");
    const state = await page.evaluate(async manifest => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const source = `export function transform(payload) {
        let parentDenied = false;
        try { void parent.document.body; }
        catch (_error) { parentDenied = true; }
        return {result:payload.text.toUpperCase(),
          parentDenied, hasBoundClient:typeof globalThis.Cluster?.request === "function"};
      }`;
      const raw = JSON.stringify(manifest);
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: { "plugin.json": btoa(raw), "entry.js": btoa(source) }
      };
      const denied = await linkCore.pluginHostInstaller.install(snapshot);
      const installed = await linkCore.pluginHostInstaller.install(
        snapshot, { consented: true });
      const response = installed.ok ? await linkCore.request(
        "ui",manifest.provider.objectId,"transform",
        { text: "abc" },{ origin: "user" }) : null;
      const frame = linkCore.pluginHostInstaller.handles.get(
        manifest.provider.providerId)?.frame;
      let inaccessible = false;
      try { void frame?.contentWindow?.document; }
      catch (_error) { inaccessible = true; }
      const result = {
        denied: denied.status, installed: installed.status,
        response, sandbox: frame?.getAttribute("sandbox"),
        inaccessible,
        log: linkCore.getSnapshot().logs.some(x =>
          x.action === "Plugin.Invoke.transform" && x.status === 200)
      };
      linkCore.pluginHostInstaller.uninstall(
        manifest.provider.providerId);
      return result;
    }, manifest());
    expect(state.denied).toBe(403);
    expect(state.installed).toBe(201);
    expect(state.sandbox).toBe("allow-scripts");
    expect(state.inaccessible).toBe(true);
    expect(state.response.ok).toBe(true);
    expect(state.response.value).toEqual({
      result: "ABC", parentDenied: true, hasBoundClient: true
    });
    expect(state.log).toBe(true);
  });

test("PR13 timeout terminates unresponsive sandbox and emits EHU",
  async ({ page }) => {
    await page.goto("/");
    const output = await page.evaluate(async manifest => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const raw = JSON.stringify(manifest);
      const source = `export async function transform() {
        return new Promise(() => {});
      }`;
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: { "plugin.json": btoa(raw), "entry.js": btoa(source) }
      };
      const installed = await linkCore.pluginHostInstaller.install(
        snapshot, { consented: true });
      if (!installed.ok) return { installed };
      const bridge = linkCore.pluginHostInstaller.handles.get(
        manifest.provider.providerId);
      const response = await bridge.invoke(
        "example.sandbox.smoke", "transform", {}, 150);
      const missingFrame = bridge.frame === null;
      const ehu = linkCore.getSnapshot().logs.some(x =>
        x.action === "Plugin.RPC.Timeout" && x.status === 504);
      linkCore.pluginHostInstaller.uninstall(
        manifest.provider.providerId);
      return { status: response.status, missingFrame, ehu };
    }, manifest("user.sandbox-timeout"));
    expect(output).toEqual({
      status: 504, missingFrame: true, ehu: true
    });
  });

test("PR13.7 sandbox CSP denies network exfiltration and host storage",
  async ({ page }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async manifest => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const source = `export async function transform() {
        let networkDenied = false;
        let storageDenied = false;
        try { await fetch("https://example.com/collect"); }
        catch { networkDenied = true; }
        try { void parent.localStorage.length; }
        catch { storageDenied = true; }
        return { networkDenied, storageDenied };
      }`;
      const raw = JSON.stringify(manifest);
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: { "plugin.json": btoa(raw), "entry.js": btoa(source) }
      };
      const installed = await linkCore.pluginHostInstaller.install(
        snapshot, { consented: true });
      if (!installed.ok) return { installed };
      const result = await linkCore.request(
        "ui", manifest.provider.objectId, "transform", {},
        { origin: "user" });
      linkCore.pluginHostInstaller.uninstall(
        manifest.provider.providerId);
      return result;
    }, manifest("user.sandbox-network"));
    expect(outcome.status).toBe(200);
    expect(outcome.value).toEqual({
      networkDenied: true, storageDenied: true
    });
  });

test("PR13.7 synchronous infinite loop cannot block host timeout",
  async ({ page }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async manifest => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const raw = JSON.stringify(manifest);
      const source = `export function transform() {
        while (true) {}
      }`;
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: { "plugin.json": btoa(raw), "entry.js": btoa(source) }
      };
      const installed = await linkCore.pluginHostInstaller.install(
        snapshot, { consented: true });
      if (!installed.ok) return { installed };
      const bridge = linkCore.pluginHostInstaller.handles.get(
        manifest.provider.providerId);
      const start = performance.now();
      const result = await bridge.invoke(
        "example.sandbox.smoke", "transform", {}, 150);
      const elapsed = performance.now() - start;
      const terminated = bridge.closed && bridge.frame === null;
      return { status: result.status, elapsed, terminated };
    }, manifest("user.sandbox-cpu-loop"));
    expect(outcome.status).toBe(504);
    expect(outcome.terminated).toBe(true);
    expect(outcome.elapsed).toBeLessThan(3000);
  });
