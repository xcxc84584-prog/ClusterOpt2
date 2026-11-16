import { test, expect } from "@playwright/test";

test("PR7 original Explorer context menu opens a file", async ({ page }) => {
  await page.goto("/");
  await page.locator("#explorerToggle").click();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const entry = page.locator("#explorerTree .explorer-entry").first();
  await expect(entry).toBeVisible();
  await entry.click({ button: "right" });
  await expect(page.locator(".explorer-context")).toBeVisible();
  await page.locator(".explorer-context button").click();
  await expect(page.locator("#tabs .tab")).toHaveCount(1);
});

test("PR7 File menu scrolls under constrained viewport", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 300 });
  await page.goto("/");
  await page.locator("#menuBtn").click();
  const menu = page.locator("#menu");
  await expect(menu).toBeVisible();
  const state = await menu.evaluate(element => {
    const style = getComputedStyle(element);
    return { height: element.getBoundingClientRect().height,
      overflow: style.overflowY, viewport: innerHeight };
  });
  expect(state.height).toBeLessThanOrEqual(state.viewport);
  expect(state.overflow).toBe("auto");
});
