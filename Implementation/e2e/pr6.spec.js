import { test, expect } from "@playwright/test";

test("PR6 Explorer reflects new tabs and searches file names", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#explorerFiles")).toBeVisible();
  await page.locator("#explorerNew").click();
  await expect(page.locator(".explorer-entry")).toHaveCount(1);
  await page.locator("#explorerNew").click();
  await expect(page.locator(".explorer-entry")).toHaveCount(2);
  await page.locator("#explorerSearch").fill("not-a-file");
  await expect(page.locator(".explorer-entry")).toHaveCount(0);
  await page.locator("#explorerSearch").fill("Untitled");
  await expect(page.locator(".explorer-entry")).toHaveCount(2);
  await page.locator(".explorer-entry").first().click();
  await expect(page.locator("#tabs .tab")).toHaveCount(2);
});
