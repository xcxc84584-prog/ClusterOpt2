import { test, expect } from "@playwright/test";

async function openPlugin(page) {
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await expect(page.locator("#pluginWindow")).toBeVisible();
}

test("Plugin tool tab preserves unsaved documents and Resources",async ({page})=>{
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await page.locator("#editor").fill("unchanged editor text");
  await openPlugin(page);
  await expect(page.locator("#pluginDialog")).toHaveCount(0);
  await expect(page.locator("#tabs .tab[data-tab-kind=tool]")).toHaveCount(1);
  await expect(page.locator("#editorPane")).toBeHidden();
  await page.locator(".pm-tabs [role=tab]").nth(3).click();
  await expect(page.locator("#pluginMaxMiB")).toBeVisible();
  await page.locator("#pluginMaxMiB").fill("16");
  await page.locator("#pluginApply").click();
  await expect(page.locator("#pluginMaxMiB")).toHaveValue("16");
  await page.locator("#tabs .tab[data-tab-kind=document]").click();
  await expect(page.locator("#editor")).toHaveValue("unchanged editor text");
  await expect(page.locator("#pluginWindow")).toBeHidden();
  await page.locator("#tabs .tab[data-tab-kind=tool]").click();
  await expect(page.locator("#pluginWindow")).toBeVisible();
  await page.locator("#tabs .tab[data-tab-kind=tool] .close").click();
  await expect(page.locator("#tabs .tab[data-tab-kind=tool]")).toHaveCount(0);
  await expect(page.locator("#editor")).toHaveValue("unchanged editor text");
});

test("PR8 tool TAB survives reload and closes cleanly",async ({page})=>{
  await page.goto("/");
  await openPlugin(page);
  await page.reload();
  await expect(page.locator("#pluginWindow")).toBeVisible();
  await expect(page.locator(".pm-tabs [role=tab]")).toHaveCount(4);
  await page.locator("#tabs .tab[data-tab-kind=tool] .close").click();
  await expect(page.locator("#pluginWindow")).toBeHidden();
  await page.reload();
  await expect(page.locator("#tabs .tab[data-tab-kind=tool]")).toHaveCount(0);
});

test("PR8 tool TAB can be reordered without editing documents",async ({page})=>{
  await page.goto("/");
  for(let i=0;i<2;i++){
    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    await page.locator("#editor").fill("document "+i);
  }
  await openPlugin(page);
  const tool=page.locator("#tabs .tab[data-tab-kind=tool]");
  const documents=page.locator("#tabs .tab[data-tab-kind=document]");
  await expect(tool).toHaveCount(1);
  await tool.dragTo(documents.first());
  await expect(page.locator("#tabs .tab").first())
    .toHaveAttribute("data-tab-kind","tool");
  await documents.last().click();
  await expect(page.locator("#editor")).toHaveValue("document 1");
  await tool.click();
  await expect(page.locator("#pluginWindow")).toBeVisible();
});

test("Plugin Manager narrow viewport supports English and sidebar toggle",
  async ({page})=>{
    await page.setViewportSize({width:420,height:650});
    await page.goto("/");
    await page.locator("#menuBtn").click();
    await page.locator("#toolBtn").click();
    await page.locator("#languageBtn").click();
    await page.locator("[data-locale=en]").click();
    await openPlugin(page);
    await expect(page.locator(".pm-tabs [role=tab]").nth(3))
      .toHaveText("Resources");
    await page.locator("#pluginSidebarToggle").click();
    await expect(page.locator("#pluginSidebarToggle"))
      .toHaveAttribute("aria-expanded","false");
    await page.locator("#pluginSidebarToggle").click();
    await expect(page.locator("#pluginSidebarToggle"))
      .toHaveAttribute("aria-expanded","true");
    const bounds=await page.locator("#pluginWindow").boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x+bounds.width).toBeLessThanOrEqual(420);
  });

test("PR8 resources replace deleted legacy plugin category controls",
  async ({page})=>{
    await page.goto("/");
    await openPlugin(page);
    await expect(page.locator("#pluginToolToggle")).toHaveCount(0);
    await expect(page.locator("#pluginCategoryMenu")).toHaveCount(0);
    await page.locator(".pm-tabs [role=tab]").nth(3).click();
    await expect(page.locator(".pm-resource-pane")).toHaveCount(2);
    await expect(page.locator("#pluginResourceSearch")).toBeVisible();
    await expect(page.locator("#pluginMaxMiB")).toBeVisible();
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
