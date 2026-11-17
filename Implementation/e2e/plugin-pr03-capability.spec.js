import {ReleaseVersion} from "../property/ReleaseVersion.js";
import { test, expect } from "@playwright/test";

test("PR03.01 real Chromium reads canonical shared policy", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { LinkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const core = new LinkCore();
    core.register({ id: "audit", receive: async () => null });
    const found = core.readProperty("audit", "CapabilityIdPolicy");
    const policy = found.value;
    return {
      status: found.status,
      valid: policy.validate("editor.highlight").status,
      invalid: policy.validate("Editor.Highlight").status,
      conflict: policy.checkUnique("editor.highlight",
        ["editor.highlight"]).status,
      propertyRegistered: core.getSnapshot().properties.some(item =>
        item.name === "CapabilityIdPolicy"),
      legacy: typeof window.Cluster?.api?.list === "function",
      version: window.Cluster?.version(),
      dependencies: core.getSnapshot().dependencies.length
    };
  });
  expect(result).toEqual({
    status: 200, valid: 200, invalid: 400, conflict: 409,
    propertyRegistered: true, legacy: true,
    version: ReleaseVersion.product, dependencies: 0
  });
});
