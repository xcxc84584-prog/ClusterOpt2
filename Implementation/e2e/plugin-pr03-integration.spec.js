import { test, expect } from "@playwright/test";

test("PR03.04-10 real browser Provider metadata lifecycle", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { LinkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const core = new LinkCore();
    const object = id => ({
      id, receive: async (_action, payload) => payload,
      ocda: {
        Request: ["highlight"], Response: [],
        UserAPI: ["highlight"], AgentAPI: [],
        Property: [], Program: {}, EHU: [], Log: []
      }
    });
    core.register(object("BrowserA"));
    core.register(object("BrowserB"));
    const manifest = (owner, provider) => ({
      manifestVersion: 1, providerId: provider, objectId: owner,
      provides: [{
        service: "editor.highlight", action: "highlight",
        version: "1.1.0", inputSchema: { type: "object" },
        outputSchema: { type: "array", items: { type: "string" } }
      }],
      requires: [], permissions: [],
      execution: { isolation: "host", concurrency: "serial" }
    });
    core.registerProvider("BrowserA", manifest("BrowserA", "browser.a"));
    core.registerProvider("BrowserB", manifest("BrowserB", "browser.b"));
    let executed = 0;
    core.attachProviderFactory("BrowserA", "browser.a",
      () => ({ stamp: ++executed }));
    const discovered = core.services.resolve("editor.highlight");
    const lazy = executed === 0;
    const negotiated = core.services.negotiate({
      service: "editor.highlight", version: "1.0.0",
      inputSchema: { type: "object" },
      outputSchema: { type: "array", items: { type: "string" } }
    });
    const wrong = core.services.negotiate({
      service: "editor.highlight", version: "2.0.0",
      inputSchema: { type: "object" },
      outputSchema: { type: "array", items: { type: "string" } }
    });
    const created = core.materializeProvider("BrowserA", "browser.a");
    core.setProviderEnabled("BrowserA", "browser.a", false);
    const remaining = core.services.resolve("editor.highlight");
    core.unregister("BrowserB");
    return {
      candidates: discovered.value.length,
      lazy, compatible: negotiated.status,
      incompatible: wrong.status,
      materialized: created.status, executed,
      remaining: remaining.value.map(m => m.providerId),
      finalStatus: core.services.resolve("editor.highlight").status,
      catalog: typeof window.Cluster?.api?.list === "function",
      version: window.Cluster.version()
    };
  });
  expect(result).toEqual({
    candidates: 2, lazy: true, compatible: 200, incompatible: 409,
    materialized: 201, executed: 1, remaining: ["browser.b"],
    finalStatus: 404, catalog: true,
    version: "0.0.11"
  });
});
