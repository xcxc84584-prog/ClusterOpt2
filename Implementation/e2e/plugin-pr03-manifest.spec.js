import {ReleaseVersion} from "../property/ReleaseVersion.js";
import { test, expect } from "@playwright/test";

test("PR03.02 real browser Hub validates metadata without execution",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      core.register({ id: "manifest-audit",
        receive: async () => { throw Error("Must not execute"); } });
      const found = core.readProperty(
        "manifest-audit", "ProviderManifestPolicy");
      const input = {
        manifestVersion: 1, providerId: "vendor.highlighter",
        objectId: "Vendor.Highlighter",
        provides: [{
          service: "editor.highlight", action: "highlight",
          version: "1.0.0",
          inputSchema: { type: "object" },
          outputSchema: { type: "array",
            items: { type: "string" } }
        }],
        requires: ["document.slice.read"],
        permissions: ["document.slice.read"],
        execution: { isolation: "worker", concurrency: "per-slice" }
      };
      const validated = found.value.validate(input);
      const invalid = found.value.validate({
        ...input, permissions: ["untrusted permission"]
      });
      return {
        status: found.status,
        valid: validated.status,
        invalid: invalid.status,
        immutable: Object.isFrozen(validated.value),
        registered: core.getSnapshot().properties.some(item =>
          item.name === "ProviderManifestPolicy"),
        events: core.getSnapshot().logs.filter(item =>
          item.action === "Property.Read" && item.status === 200).length,
        dependencies: core.getSnapshot().dependencies.length,
        oldApi: typeof window.Cluster?.api?.list === "function",
        version: window.Cluster?.version()
      };
    });
    expect(result).toEqual({
      status: 200, valid: 200, invalid: 400, immutable: true,
      registered: true, events: 1, dependencies: 0,
      oldApi: true, version: ReleaseVersion.product
    });
  });
