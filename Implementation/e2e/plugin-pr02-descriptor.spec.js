import { test, expect } from "@playwright/test";

test("PLUGIN PR02.01 descriptor executes through real browser LinkCore",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      core.register({ id: "audit", receive: async () => null });
      const property = core.readProperty("audit", "APIDescriptorPolicy");
      if (!property.ok) return { fail: property.status };
      const descriptor = property.value.validate({
        apiVersion: 1, id: "editor.highlight",
        owner: "Example.Highlighter", action: "highlight",
        version: "1.0.0", visibility: "Public", sideEffect: "none",
        inputSchema: { type: "object" },
        outputSchema: {
          type: "array", items: { type: "object" }
        }
      });
      return {
        registered: core.getSnapshot().properties.some(item =>
          item.name === "APIDescriptorPolicy"),
        valid: descriptor.ok,
        readonly: Object.isFrozen(descriptor.value),
        legacyAPI: typeof window.Cluster?.log === "function"
      };
    });
    expect(result).toEqual({
      registered: true, valid: true, readonly: true, legacyAPI: true
    });
  });
