import { test, expect } from "@playwright/test";

test("PR8 Plugin Performance controls actual SliceRegistry budget", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await page.locator("#pluginPerformanceBtn").click();
  await expect(page.locator("#pluginMaxMiB")).toHaveValue("8");
  await page.locator("#pluginUnlimited").check();
  await page.locator("#pluginApply").click();
  await expect(page.locator("#pluginUnlimited")).toBeChecked();
  await page.reload();
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await page.locator("#pluginPerformanceBtn").click();
  await expect(page.locator("#pluginUnlimited")).toBeChecked();
  await expect(page.locator("#pluginHighlighterBtn")).toBeDisabled();
});
