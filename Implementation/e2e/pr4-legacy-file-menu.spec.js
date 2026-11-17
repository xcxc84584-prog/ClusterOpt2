import { test, expect } from "@playwright/test";

test("legacy File menu keeps order and original priority selector", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();

  await expect(page.locator("#closeFile")).toBeVisible();
  await expect(page.locator("#closeAllMain")).toBeVisible();
  await page.locator("#toolBtn").click();
  await expect(page.locator("#closeAll")).toHaveCount(0);
  await expect(page.locator("#priority")).toHaveValue("internal");
  await expect(page.locator("#pluginBtn")).toBeEnabled();
  await page.locator("#pluginBtn").click();
  await expect(page.locator(".pm-tabs [role=tab]")).toHaveCount(4);
  await page.locator(".pm-tabs [role=tab]").nth(3).click();
  await expect(page.locator("#pluginMaxMiB")).toBeVisible();
  await page.locator("#tabs .tab[data-tab-kind=tool] .close").click();
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await expect(page.locator("#blockedTypesBtn")).toBeEnabled();

  await page.locator("#priority").selectOption("external");
  await expect(page.locator("#priority")).toHaveValue("external");
  const priority = await page.evaluate(() =>
    Cluster.propertylist().find(item => item.name === "StoragePriority"));
  expect(priority).toBeTruthy();

  // Changing priority closes the File menu via perform().
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#languageBtn").click();
  await page.locator('[data-locale="en"]').click();
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await expect(page.locator("#priorityHeading")).toHaveText("Storage Priority");
  await expect(page.locator('#priority option[value="internal"]'))
    .toHaveText("Internal First");
  await expect(page.locator("#priority")).toHaveValue("external");
});
