import { test, expect } from "@playwright/test";

async function openPluginTab(page, index) {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await page.locator(".pm-tabs [role=tab]").nth(index).click();
}

async function refreshTool(page) {
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
}

test("PR13 UI API list survives tool refresh without scroll reset",
  async ({ page }) => {
    await openPluginTab(page, 1);
    const table = page.locator(".pm-api-table-wrap");
    await expect(table).toBeVisible();
    const before = await table.evaluate(node => {
      node.scrollTop = 180;
      window.__previousAPI = node;
      return node.scrollTop;
    });
    expect(before).toBeGreaterThan(0);
    await refreshTool(page);
    const after = await table.evaluate(node => ({
      sameNode: node === window.__previousAPI,
      scrollTop: node.scrollTop
    }));
    expect(after.sameNode).toBe(true);
    expect(after.scrollTop).toBe(before);
  });

test("PR13 resource search retains focus and text through tool refresh",
  async ({ page }) => {
    await openPluginTab(page, 3);
    const input = page.locator("#pluginResourceSearch");
    await input.fill("template");
    await expect(page.locator(".pm-market-card")).toHaveCount(1);
    await expect(page.locator("#pluginTemplateDownload")).toBeVisible();
    await input.evaluate(node => {
      window.__previousSearch = node;
      node.focus();
    });
    await refreshTool(page);
    const state = await input.evaluate(node => ({
      sameNode: node === window.__previousSearch,
      value: node.value,
      focused: document.activeElement === node
    }));
    expect(state.sameNode).toBe(true);
    expect(state.value).toBe("template");
    // Clicking the menu changes focus; input must remain usable.
    await input.fill("highlight");
    await expect(page.locator(".pm-market-card")).toHaveCount(1);
    await expect(page.locator("#pluginTemplateDownload")).toHaveCount(0);
  });

test("PR13 author template is a plugin catalogue item, not overlay UI",
  async ({ page }) => {
    await openPluginTab(page, 3);
    await expect(page.locator(".pm-template-card")).toHaveCount(0);
    const template = page.locator(".pm-market-card").filter({
      has: page.locator("#pluginTemplateDownload")
    });
    await expect(template).toHaveCount(1);
    await expect(template).toContainText("API");
    await expect(template.locator("button")).toHaveCount(1);
    await expect(page.locator("#pluginAgentDownload")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.locator("#pluginTemplateDownload").click();
    expect((await download).suggestedFilename())
      .toBe("ClusterOpt2-Plugin-Template-ZH.zip");
  });
