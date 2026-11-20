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
        entry: "worker.js", provider
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
        snapshot, { consented: true });
      if (!install.ok) return { install };
      const bridge = linkCore.pluginHostInstaller.handles.get(
        provider.providerId);
      const result = await linkCore.request("ui", provider.objectId,
        "transform", {}, { origin: "user" });
      const events = linkCore.getSnapshot().logs.filter(event =>
        event.action.startsWith("RPC.Request.") ||
        event.action.startsWith("RPC.Response."));
      const active = bridge.hostTransport?.gateway.sessions.activeCount;
      const removed = linkCore.pluginHostInstaller.uninstall(
        provider.providerId);
      return {
        install: install.status, result, events: events.length,
        active, removed: removed.status,
        closed: bridge.closed,
        sessionsAfter: bridge.hostTransport
      };
    });
    expect(outcome.install).toBe(201);
    expect(outcome.result.status).toBe(200);
    expect(outcome.result.value).toEqual({
      objectId: "UICO", denied: true
    });
    expect(outcome.events).toBeGreaterThanOrEqual(2);
    expect(outcome.active).toBe(1);
    expect(outcome.removed).toBe(200);
    expect(outcome.closed).toBe(true);
    expect(outcome.sessionsAfter).toBeNull();
  });
