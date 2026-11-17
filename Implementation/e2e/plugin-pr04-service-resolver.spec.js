import { test, expect } from "@playwright/test";

test("PR04.01 real Chromium Service routing and legacy compatibility",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      const object = id => ({
        id, receive: async (_action, payload) => payload.text,
        ocda: {
          Request: ["highlight"], Response: [],
          UserAPI: ["highlight"], AgentAPI: [],
          Property: [], Program: {}, EHU: [], Log: []
        }
      });
      core.register(object("Caller"));
      core.register(object("Provider"));
      const status = core.registerProvider("Provider", {
        manifestVersion: 1, providerId: "vendor.browser",
        objectId: "Provider", provides: [{
          service: "editor.highlight", action: "highlight",
          version: "1.0.0", inputSchema: { type: "object" },
          outputSchema: { type: "string" }
        }],
        requires: [], permissions: [],
        execution: { isolation: "worker", concurrency: "serial" }
      }).status;
      const old = await core.request("Caller", "Provider",
        "highlight", { text: "old" });
      const fresh = await core.requestService("Caller",
        "editor.highlight", "highlight", { text: "new" },
        { origin: "user" });
      return {
        status, old: old.value, fresh: fresh.value,
        dependencies: core.getSnapshot().dependencies.length,
        existingApi: typeof window.Cluster?.api?.list
      };
    });
    expect(result).toEqual({
      status: 201, old: "old", fresh: "new",
      dependencies: 2, existingApi: "function"
    });
  });
