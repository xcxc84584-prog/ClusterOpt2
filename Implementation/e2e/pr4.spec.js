import { test, expect } from "@playwright/test";

test("PR4 Close All cancels safely and supports bilingual menu", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await page.locator("#editor").fill("unsaved");
  await page.locator("#menuBtn").click();
  await expect(page.locator("#closeAllMain")).toBeVisible();
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator("#closeAllMain").click();
  await expect(page.locator("#tabs .tab")).toHaveCount(1);

  await page.locator("#menuBtn").click();
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#closeAllMain").click();
  await expect(page.locator("#tabs .tab")).toHaveCount(0);

  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#languageBtn").click();
  await page.locator('[data-locale="en"]').click();
  await page.locator("#menuBtn").click();
  await expect(page.locator("#closeAllMain")).toHaveText("Close All");
});

test("PR4 native drag and drop reorders tabs without losing text", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 3; i++) {
    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    await page.locator("#editor").fill("document " + i);
  }
  const tabs = page.locator("#tabs .tab");
  await expect(tabs).toHaveCount(3);
  await tabs.first().dragTo(tabs.last());
  await expect(tabs.first()).not.toHaveClass(/active/);
  await tabs.last().click();
  await expect(page.locator("#editor")).toHaveValue("document 0");
});
