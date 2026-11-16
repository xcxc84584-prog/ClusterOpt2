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
  await expect(page.locator("#pluginHighlighterBtn")).toBeDisabled();
  await expect(page.locator("#pluginProcessorBtn")).toBeDisabled();
  await expect(page.locator("#pluginCommitterBtn")).toBeDisabled();
  await expect(page.locator("#pluginProcessorApi")).toHaveAttribute(
    "download", "");
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
