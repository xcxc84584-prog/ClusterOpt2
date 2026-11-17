import { test, expect } from "@playwright/test";

/**
 * Real Chromium host integration: the directory picker and OS permission
 * are stubbed; actual Windows consent still requires a manual test.
 */
async function mount(page) {
  return page.evaluate(async () => {
    const { linkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const files = {};
    for (const name of ["plugin.json", "worker.js", "index.html",
      "README.md", "locales/en.json", "locales/zh-Hant.json"]) {
      const response = await fetch(
        "/Implementation/plugins/ai-agent-mcp/" + name);
      const bytes = new Uint8Array(await response.arrayBuffer());
      files[name] = btoa(String.fromCharCode(...bytes));
    }
    const manifestText = await (await fetch(
      "/Implementation/plugins/ai-agent-mcp/plugin.json")).text();
    return linkCore.pluginHostInstaller.install({
      format: "cluster-plugin-folder", formatVersion: 1,
      manifestText, files
    }, { consented: true, approvedPermissions: [
      "network.request", "local-agent.pair",
      "model.configure", "model.task"
    ] });
  });
}

test("PR14.6 ToolBox requires browser scope and a matching path",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.__folderRights = "granted";
      window.__folder = {
        kind: "directory", name: "Project",
        queryPermission: async () => window.__folderRights,
        requestPermission: async () => window.__folderRights,
        async *entries() { yield ["safe.txt", { kind: "file" }]; }
      };
      window.showDirectoryPicker = async () => window.__folder;
      window.prompt = () => ["C:", "Work", "Project"].join("\\");
    });
    expect((await mount(page)).status).toBe(201);
    await page.locator(".plugin-extension-button").click();
    const trigger = page.locator(".plugin-agent-toolbox > button");
    await trigger.click();
    const menu = page.locator(".plugin-agent-toolbox > div");
    await expect(menu).toBeVisible();
    await menu.getByRole("button", {
      name: /選取本地資料夾/
    }).click();
    await expect(menu.getByRole("status"))
      .toContainText("已取得所選資料夾授權");
    const unchecked = await menu.locator('input[type="checkbox"]')
      .evaluateAll(nodes => nodes.every(node => !node.checked));
    expect(unchecked).toBe(true);
    const allowed = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const view = linkCore.pluginHostInstaller.uiHost.views
        .get("cluster.ai-agent-mcp");
      return {
        selected: view.explorerAccess.status().selected,
        labelLeaked: JSON.stringify(
          view.explorerAccess.status()).includes("Work"),
        read: (await linkCore.request("ui",
          view.explorerAccess.id, "list", {},
          { origin: "user" })).status
      };
    });
    expect(allowed).toEqual({
      selected: true, labelLeaked: false, read: 403
    });
    await menu.locator('[data-right="read"]').check();
    const opened = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const view = linkCore.pluginHostInstaller.uiHost.views
        .get("cluster.ai-agent-mcp");
      return linkCore.request("ui", view.explorerAccess.id,
        "list", {}, { origin: "user" });
    });
    expect(opened.status).toBe(200);
    expect(opened.value.entries[0].name).toBe("safe.txt");
    await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      linkCore.pluginHostInstaller.disable("cluster.ai-agent-mcp");
    });
    await expect(menu).toBeHidden();
    await expect(menu.locator('[data-right="read"]'))
      .not.toBeChecked();
  });

test("PR14.6 rejects path mismatch and refused browser consent",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.__folderRights = "granted";
      window.showDirectoryPicker = async () => ({
        kind: "directory", name: "Project",
        queryPermission: async () => window.__folderRights
      });
      window.prompt = () => ["C:", "Work", "Elsewhere"].join("\\");
    });
    expect((await mount(page)).status).toBe(201);
    await page.locator(".plugin-extension-button").click();
    await page.locator(".plugin-agent-toolbox > button").click();
    const pick = page.getByRole("button", {
      name: /選取本地資料夾/
    });
    await pick.click();
    const state = async () => page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return linkCore.pluginHostInstaller.uiHost.views
        .get("cluster.ai-agent-mcp").explorerAccess.status();
    });
    expect((await state()).selected).toBe(false);
    await page.evaluate(() => {
      window.prompt = () => ["C:", "Work", "Project"].join("\\");
      window.__folderRights = "denied";
    });
    await pick.click();
    expect((await state()).selected).toBe(false);
  });
