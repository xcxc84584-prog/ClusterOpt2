import { test, expect } from "@playwright/test";

test("PR03.03 real browser URU/Hub registration lifecycle", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { LinkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const core = new LinkCore();
    core.register({
      id: "PluginA", receive: async () => null,
      ocda: {
        Request: ["highlight"], Response: [], UserAPI: ["highlight"],
        AgentAPI: [], Property: [], Program: {}, EHU: [], Log: []
      }
    });
    const manifest = {
      manifestVersion: 1, providerId: "vendor.highlighter",
      objectId: "PluginA", provides: [{
        service: "editor.highlight", action: "highlight", version: "1.0.0",
        inputSchema: { type: "object" },
        outputSchema: { type: "array", items: { type: "string" } }
      }],
      requires: [], permissions: [],
      execution: { isolation: "worker", concurrency: "serial" }
    };
    const registration = core.registerProvider("PluginA", manifest);
    const count = core.uru.listProviders().length;
    const oldAPI = typeof window.Cluster?.api?.list === "function";
    core.unregister("PluginA");
    return {
      registered: registration.status, count,
      cleared: core.uru.listProviders().length,
      oldAPI,
      logs: core.getSnapshot().logs.some(event =>
        event.action === "Provider.Register" && event.status === 201),
      version: window.Cluster.version()
    };
  });
  expect(r).toEqual({
    registered: 201, count: 1, cleared: 0, oldAPI: true,
    logs: true, version: "0.0.9-pr9.patch9"
  });
});
