import { test, expect } from "@playwright/test";

async function openPlugin(page) {
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await expect(page.locator("#pluginWindow")).toBeVisible();
}

test("PR8 Plugin opens as a single file-style TAB, not a modal", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await page.locator("#editor").fill("unchanged editor text");
  await openPlugin(page);
  await expect(page.locator("#pluginDialog")).toHaveCount(0);
  await expect(page.locator("#tabs .tab[data-tab-kind=tool]")).toHaveCount(1);
  await expect(page.locator("#editorPane")).toBeHidden();
  await expect(page.locator("#pluginWindow")).toBeVisible();
  await expect(page.locator("#pluginMaxMiB")).toHaveValue("8");
  await page.locator("#pluginHighlighterBtn").click();
  await expect(page.locator("#pluginHighlighterOptions")).toBeVisible();
  await page.locator("#pluginProcessorBtn").click();
  await expect(page.locator("#pluginProcessorApi")).toHaveAttribute(
    "download", "");
  await page.locator("#pluginCommitterBtn").click();
  await expect(page.locator("#pluginCommitterApi")).toHaveAttribute(
    "download", "");
  await page.locator("#pluginPerformanceBtn").click();
  await page.locator("#pluginUnlimited").check();
  await page.locator("#pluginApply").click();
  await page.locator("#tabs .tab[data-tab-kind=document]").click();
  await expect(page.locator("#editor")).toHaveValue("unchanged editor text");
  await expect(page.locator("#pluginWindow")).toBeHidden();
  await page.locator("#tabs .tab[data-tab-kind=tool]").click();
  await expect(page.locator("#pluginWindow")).toBeVisible();
  await page.locator("#pluginDone").click();
  await expect(page.locator("#tabs .tab[data-tab-kind=tool]")).toHaveCount(0);
  await expect(page.locator("#editor")).toHaveValue("unchanged editor text");
  await openPlugin(page);
  await expect(page.locator("#pluginUnlimited")).toBeChecked();
  await openPlugin(page);
  await expect(page.locator("#tabs .tab[data-tab-kind=tool]")).toHaveCount(1);
});

test("PR8 category buttons sit in tool-window top-right, not global header", async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 700 });
  await page.goto("/");
  await openPlugin(page);
  const bounds = await page.evaluate(() => {
    const window = document.querySelector("#pluginWindow")
      .getBoundingClientRect();
    const categories = document.querySelector(".plugin-window-categories")
      .getBoundingClientRect();
    const heading = document.querySelector(".plugin-workbench-identity")
      .getBoundingClientRect();
    return { window: { x: window.x, y: window.y, right: window.right },
      categories: { x: categories.x, y: categories.y,
        right: categories.right }, heading: { right: heading.right } };
  });
  expect(bounds.categories.x).toBeGreaterThan(bounds.heading.right);
  expect(bounds.categories.right).toBeLessThanOrEqual(bounds.window.right);
  expect(bounds.categories.y).toBeGreaterThanOrEqual(bounds.window.y);
  const relation = await page.evaluate(() =>
    Cluster.rep().filter(item => item.link.includes("tool-tab-manager")));
  expect(relation.some(item => item.code === "10")).toBe(true);
  expect(relation.some(item => item.code === "01")).toBe(true);
});

test("PR8 Plugin tool window supports narrow viewport and language", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 650 });
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#languageBtn").click();
  await page.locator("[data-locale=en]").click();
  await openPlugin(page);
  await expect(page.locator("#pluginDialogTitle")).toHaveText(
    "Plugin Manager");
  const box = await page.locator("#pluginWindow").boundingBox();
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
  await expect(page.locator("#blockedTypesError")).toContainText(
    "此副檔名已存在");
  await expect(row.locator("code")).toHaveText(".mp4");
  await page.locator("#blockedTypesDone").click();
});
