import { test, expect } from "@playwright/test";

test("PR7 File Tool type dialog filters Explorer only", async ({ page }) => {
  await page.goto("/");
  await page.locator("#explorerToggle").click();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await expect(page.locator("#explorerTree .explorer-entry")).toHaveCount(1);
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#blockedTypesBtn").click();
  await expect(page.locator("#blockedTypesDialog")).toBeVisible();
  await page.locator("#blockedTypesInput").fill(".txt");
  await page.locator("#blockedTypesAdd").click();
  await expect(page.locator("#explorerTree .explorer-entry")).toHaveCount(0);
  await expect(page.locator("#tabs .tab")).toHaveCount(1);
});
