import { test, expect } from "@playwright/test";

async function openResources(page) {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await page.locator(".pm-tabs [role=tab]").nth(3).click();
}

test("PR13 download template switches between Chinese and English ZIP",
  async ({ page }) => {
    await openResources(page);
    const button = page.locator("#pluginTemplateDownload");
    await expect(button).toBeVisible();
    await expect(page.locator(".pm-resource-downloads"))
      .toContainText("API");
    const chinese = page.waitForEvent("download");
    await button.click();
    expect((await chinese).suggestedFilename())
      .toBe("ClusterOpt2-Plugin-Template-ZH.zip");
    await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      linkCore.edpmu.update("Language", "en");
    });
    await page.locator(".pm-tabs [role=tab]").nth(1).click();
    await page.locator(".pm-tabs [role=tab]").nth(3).click();
    const english = page.waitForEvent("download");
    await page.locator("#pluginTemplateDownload").click();
    expect((await english).suggestedFilename())
      .toBe("ClusterOpt2-Plugin-Template-EN.zip");
  });
