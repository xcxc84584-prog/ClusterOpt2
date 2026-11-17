import { test, expect } from "@playwright/test";

const PROVIDER = "cluster.sample.multilang-highlighter";

test("PR13 reviewed plugin survives reload without restoring grants",
  async ({ page }) => {
    await page.goto("/");
    const saved = await page.evaluate(async providerId => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return linkCore.rememberReviewedPlugin(providerId, false);
    }, PROVIDER);
    expect(saved.ok).toBe(true);
    await page.reload();
    await expect.poll(() => page.evaluate(async providerId => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return {
        exists: Boolean(linkCore.uru.getProvider(providerId)),
        disabled: linkCore.uru.disabledProviders.has(providerId),
        permissions: linkCore.uru.getProvider(providerId)?.permissions ?? []
      };
    }, PROVIDER)).toEqual({
      exists: true, disabled: true, permissions: []
    });
    await page.evaluate(async providerId => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      await linkCore.forgetReviewedPlugin(providerId);
    }, PROVIDER);
  });
