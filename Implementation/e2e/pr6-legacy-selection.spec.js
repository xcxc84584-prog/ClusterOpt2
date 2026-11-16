import { test, expect } from "@playwright/test";

test("PR6 Explorer highlights only one row after folder import", async ({ page }) => {
  await page.goto("/");
  await page.locator("#explorerToggle").click();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const nodes = page.locator("#explorerTree .explorer-entry");
  await expect(nodes).toHaveCount(2);
  await expect(page.locator("#explorerTree .explorer-entry.active")).toHaveCount(1);
  await nodes.first().click();
  await expect(page.locator("#explorerTree .explorer-entry.active")).toHaveCount(1);
  await expect(nodes.first()).toHaveClass(/active/);
});

test("PR6 context actions mirror legacy inline toolbar", async ({ page }) => {
  await page.goto("/");
  await page.locator("#explorerToggle").click();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const entry = page.locator("#explorerTree .explorer-entry").first();
  await entry.click({ button: "right" });
  const toolbar = page.locator(".explorer-inline-actions");
  await expect(toolbar).toBeVisible();
  await expect(toolbar.locator("button")).toHaveCount(4);
  await expect(toolbar.locator('[data-action="rename"]')).toBeDisabled();
  await toolbar.locator('[data-action="more"]').click();
  await expect(toolbar.locator("button")).toHaveCount(6);
  await toolbar.locator('[data-action="back"]').click();
  await expect(toolbar.locator("button")).toHaveCount(4);
  await expect(page.locator("#explorerTree .explorer-entry.active"))
    .toHaveCount(1);
  await expect(page.locator("#explorerSearch")).toHaveCSS(
    "border-radius", "10px");
});
