import { test, expect } from "@playwright/test";

test("PR8 Plugin dialog persists the registry memory budget", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await expect(page.locator("#pluginDialog")).toBeVisible();
  await expect(page.locator("#pluginMaxMiB")).toHaveValue("8");
  await page.locator("#pluginUnlimited").check();
  await page.locator("#pluginApply").click();
  await expect(page.locator("#pluginUnlimited")).toBeChecked();
  await page.locator("#pluginHighlighterBtn").click();
  await expect(page.locator("#pluginHighlighterOptions")).toBeVisible();
  await expect(page.locator("#pluginHighlighterState")).toBeVisible();
  await expect(page.locator("#pluginHighlighterApi")).toHaveAttribute(
    "download", "");
  await page.locator("#pluginProcessorBtn").click();
  await expect(page.locator("#pluginProcessorOptions")).toBeVisible();
  await expect(page.locator("#pluginProcessorApi")).toHaveAttribute(
    "download", "");
  await page.locator("#pluginCommitterBtn").click();
  await expect(page.locator("#pluginCommitterOptions")).toBeVisible();
  await page.locator("#pluginPerformanceBtn").click();
  await expect(page.locator("#pluginPerformanceOptions")).toBeVisible();
  await page.locator("#pluginDone").click();
  await expect(page.locator("#pluginDialog")).not.toBeVisible();
  await page.reload();
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await expect(page.locator("#pluginUnlimited")).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pluginDialog")).not.toBeVisible();
});

test("PR8 Plugin dialog fits narrow viewport and follows language", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 650 });
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#languageBtn").click();
  await page.locator("[data-locale=en]").click();
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await expect(page.locator("#pluginDialogTitle")).toHaveText(
    "Plugin Manager");
  const box = await page.locator("#pluginDialog").boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(420);
});

test("PR8 blocked file types preserve original compact edit/remove UI", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#blockedTypesBtn").click();
  await expect(page.locator("#blockedTypesDialog")).toBeVisible();
  const row = page.locator(".file-tool-type-row").filter({
    has: page.locator("code", { hasText: ".mp4" })
  });
  await expect(row.locator(".file-tool-type-actions button")).toHaveCount(2);
  await expect(row.locator(".file-tool-type-actions button").first())
    .toHaveText("✎");
  await expect(row.locator(".file-tool-type-actions button").last())
    .toHaveText("×");
  page.once("dialog", dialog => dialog.accept(".mov"));
  await row.locator(".file-tool-type-actions button").first().click();
  await expect(page.locator("#blockedTypesError")).toBeVisible();
  await expect(page.locator("#blockedTypesError")).toContainText(
    "此副檔名已存在");
  await expect(row.locator("code")).toHaveText(".mp4");
  await page.locator("#blockedTypesDone").click();
});
