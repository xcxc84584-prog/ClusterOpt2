import { test, expect } from "@playwright/test";

test("PR13 API List uses compact HubUnit req/rep table", async ({
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
  await expect(table.locator("thead")).toContainText("Request");
  await expect(table.locator("thead")).toContainText("Response");
  await expect(window.locator(".pm-api-search")).toBeVisible();
  await expect(window.locator(".pm-api-entry")).toHaveCount(0);
});
