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
  await page.locator("#pluginCategoryBtn").click();
  await page.locator("#pluginHighlighterBtn").click();
  await expect(page.locator("#pluginHighlighterOptions")).toBeVisible();
  await page.locator("#pluginCategoryBtn").click();
  await page.locator("#pluginProcessorBtn").click();
  await expect(page.locator("#pluginProcessorApi")).toHaveAttribute(
    "download", "");
  await page.locator("#pluginCategoryBtn").click();
  await page.locator("#pluginCommitterBtn").click();
  await expect(page.locator("#pluginCommitterApi")).toHaveAttribute(
    "download", "");
  await page.locator("#pluginCategoryBtn").click();
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

test("PR8 tool TAB and selected category survive reload independently", async ({ page }) => {
  await page.goto("/");
  await openPlugin(page);
  await page.locator("#pluginCategoryBtn").click();
  await page.locator("#pluginProcessorBtn").click();
  await expect(page.locator("#pluginProcessorOptions")).toBeVisible();
  await page.reload();
  await expect(page.locator("#pluginWindow")).toBeVisible();
  await expect(page.locator("#tabs .tab[data-tab-kind=tool]")).toHaveCount(1);
  await expect(page.locator("#pluginProcessorOptions")).toBeVisible();
  await page.locator("#tabs .tab[data-tab-kind=tool] .close").click();
  await expect(page.locator("#pluginWindow")).toBeHidden();
  await page.reload();
  await expect(page.locator("#tabs .tab[data-tab-kind=tool]")).toHaveCount(0);
});

test("PR8 tool TAB participates in drag ordering without touching file text", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 2; i++) {
    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    await page.locator("#editor").fill("document " + i);
  }
  await openPlugin(page);
  const tool = page.locator("#tabs .tab[data-tab-kind=tool]");
  const documents = page.locator("#tabs .tab[data-tab-kind=document]");
  await expect(tool).toHaveCount(1);
  await tool.dragTo(documents.first());
  await expect(page.locator("#tabs .tab").first())
    .toHaveAttribute("data-tab-kind", "tool");
  await documents.last().click();
  await expect(page.locator("#editor")).toHaveValue("document 1");
  await page.locator("#tabs .tab[data-tab-kind=tool]").click();
  await expect(page.locator("#pluginWindow")).toBeVisible();
});

test("PR8 category buttons sit in tool-window top-right, not global header", async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 700 });
  await page.goto("/");
  await openPlugin(page);
  const bounds = await page.evaluate(() => {
    const window = document.querySelector("#pluginWindow")
      .getBoundingClientRect();
    const categories = document.querySelector(".plugin-category-control")
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
  await expect(page.locator("#pluginCategoryLabel")).toHaveText("Performance");
  const box = await page.locator("#pluginWindow").boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(420);
});

test("PR8 Plugin category dropdown is collapsed and keyboard accessible", async ({ page }) => {
  await page.goto("/");
  await openPlugin(page);
  await expect(page.locator("#pluginCategoryMenu")).toBeHidden();
  await expect(page.locator("#pluginCategoryBtn")).toHaveAttribute(
    "aria-expanded", "false");
  await page.locator("#pluginCategoryBtn").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#pluginCategoryMenu")).toBeVisible();
  await expect(page.locator("#pluginPerformanceBtn")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#pluginHighlighterBtn")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#pluginCategoryMenu")).toBeHidden();
  await expect(page.locator("#pluginHighlighterOptions")).toBeVisible();
  await expect(page.locator("#pluginCategoryLabel")).toContainText("文本著色器");
  await page.locator("#pluginCategoryBtn").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#pluginCategoryMenu")).toBeHidden();
  await expect(page.locator("#pluginCategoryBtn")).toBeFocused();
  await page.locator("#pluginCategoryBtn").click();
  await page.locator("#pluginDialogTitle").click();
  await expect(page.locator("#pluginCategoryMenu")).toBeHidden();
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
