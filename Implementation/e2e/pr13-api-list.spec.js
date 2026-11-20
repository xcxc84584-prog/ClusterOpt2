import { test, expect } from "@playwright/test";

test("PR25 API List uses live source-side paginated contracts", async ({
  page
}) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  const window = page.locator("#pluginWindow");
  await expect(window).toBeVisible();
  await window.locator(".pm-tab").filter({ hasText: "API" }).click();
  const table = window.locator(".pm-api-table");
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveCount(6);
  await expect(table.locator("thead")).toContainText(/Version|版本/);
  await expect(table.locator("thead")).toContainText(/Status|狀態/);
  await expect(window.locator(".pm-api-kind")).toBeVisible();
  await expect(window.locator(".pm-api-toolbar select")).toHaveCount(1);
  await expect(window.locator(".pm-api-toolbar input")).toHaveCount(1);
  await expect(window.locator(".pm-api-toolbar button")).toHaveCount(0);
  await expect(window.locator(".pm-api-pagination")).toBeVisible();
  await expect(window.locator(".pm-api-search")).toBeVisible();
  await expect(window.locator(".pm-api-entry")).toHaveCount(0);
});
