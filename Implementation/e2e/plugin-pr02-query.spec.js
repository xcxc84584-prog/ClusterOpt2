import { test, expect } from "@playwright/test";

test("PR02.05 internal read-only catalog queries run in Chromium",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      const make = owner => ({
        id: owner, strictOCDA: true,
        receive: async () => "hello",
        ocda: {
          Request: ["run"], Response: ["run"], UserAPI: ["run"],
          AgentAPI: [], Property: [], Program: "Test",
          EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
          APIDescriptors: [{
            apiVersion: 1, id: "example.run", owner, action: "run",
            version: "1.0.0", visibility: "Public", sideEffect: "none",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" }
          }]
        }
      });
      core.register(make("Example.B"));
      core.register(make("Example.A"));
      const first = core.catalogQuery.list("api", { limit: 1 });
      const second = core.catalogQuery.list("api",
        { offset: first.value.nextOffset, limit: 1 });
      return {
        first: first.value.items[0].owner,
        second: second.value.items[0].owner,
        ambiguous: core.catalogQuery.describe("api",
          "example.run").status,
        specific: core.catalogQuery.describe("api", "example.run",
          "Example.A").status,
        denied: core.catalogQuery.query("api",
          {}, { limit: 999 }).status,
        legacy: typeof window.Cluster?.log === "function"
      };
    });
    expect(result).toEqual({
      first: "Example.A", second: "Example.B",
      ambiguous: 409, specific: 200, denied: 400, legacy: true
    });
  });
