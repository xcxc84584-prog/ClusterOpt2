import { test, expect } from "@playwright/test";

test("PR6 uses the original ClusterOpt Explorer shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#explorerPanel")).toBeHidden();
  await page.locator("#explorerToggle").click();
  await expect(page.locator("#explorerPanel")).toBeVisible();
  await expect(page.locator("#explorerAddFolder")).toBeVisible();
  await expect(page.locator("#explorerAddFile")).toBeVisible();
  await expect(page.locator("#explorerRefresh")).toBeVisible();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await expect(page.locator("#explorerTree .explorer-entry")).toHaveCount(1);
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await expect(page.locator("#explorerTree .explorer-entry")).toHaveCount(2);
  await page.locator("#explorerSearch").fill("not-a-file");
  await expect(page.locator("#explorerTree .explorer-entry")).toHaveCount(0);
  await page.locator("#explorerSearch").fill("Untitled");
  await expect(page.locator("#explorerTree .explorer-entry")).toHaveCount(2);
  await page.locator("#explorerTree .explorer-entry").first().click();
  await expect(page.locator("#tabs .tab")).toHaveCount(2);
  await page.locator("#explorerClose").click();
  await expect(page.locator("#explorerPanel")).toBeHidden();
});
