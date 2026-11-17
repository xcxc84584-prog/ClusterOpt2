import { test, expect } from "@playwright/test";

test("PR02.07 immutable compatibility metadata in real Chromium",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const { CatalogVersionPolicy } = await import(
        "/Implementation/property/CatalogVersionPolicy.js");
      const core = new LinkCore();
      core.register({ id: "guest", receive: async () => null });
      const target = {
        id: "Editor", strictOCDA: true,
        receive: async (_action, value) => value,
        ocda: {
          Request: ["render"], Response: ["render"],
          UserAPI: ["render"], AgentAPI: [],
          Property: [], Program: "Test",
          EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
          APIDescriptors: [{
            apiVersion: 1, id: "editor.render",
            owner: "Editor", action: "render",
            version: "2.3.0", since: "2.0.0", deprecated: true,
            visibility: "Public", sideEffect: "none",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" }
          }]
        }
      };
      core.register(target);
      const response = core.discover("guest", "describe", "api",
        { id: "editor.render", owner: "Editor" });
      const policy = CatalogVersionPolicy.inspect(
        response.value.descriptor, "2.2.0");
      const older = CatalogVersionPolicy.inspect(
        response.value.descriptor, "1.9.0");
      return {
        compatible: policy.value.compatible,
        deprecated: policy.value.deprecated,
        older: older.value.compatible,
        readonly: Object.isFrozen(response.value.descriptor),
        original: typeof window.Cluster?.version === "function"
      };
    });
    expect(result).toEqual({
      compatible: true, deprecated: true, older: false,
      readonly: true, original: true
    });
  });
