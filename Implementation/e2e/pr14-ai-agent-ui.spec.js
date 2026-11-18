import { test, expect } from "@playwright/test";

async function installAgentUI(page) {
  return page.evaluate(async () => {
    const { linkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const names = [
      "plugin.json", "worker.js", "index.html",
      "README.md", "locales/en.json", "locales/zh-Hant.json"
    ];
    const files = {};
    for (const name of names) {
      const response = await fetch(
        "/Implementation/plugins/ai-agent-mcp/" + name);
      if (!response.ok) throw Error("Missing asset: " + name);
      const bytes = new Uint8Array(await response.arrayBuffer());
      files[name] = btoa(String.fromCharCode(...bytes));
    }
    const raw = new TextDecoder().decode(
      Uint8Array.from(atob(files["plugin.json"]),
        char => char.charCodeAt(0)));
    const snapshot = {
      format: "cluster-plugin-folder",
      formatVersion: 1, manifestText: raw, files
    };
    window.__pr14TestSnapshot = snapshot;
    const denied = await linkCore.pluginHostInstaller.install(snapshot, {
      approvedPermissions: ["network.request", "local-agent.pair",
      "model.configure", "model.task",
      "shell.execute", "mcp.read"]
    });
    const installed = await linkCore.pluginHostInstaller.install(
      snapshot, { consented: true, approvedPermissions: ["network.request", "local-agent.pair",
      "model.configure", "model.task",
      "shell.execute", "mcp.read"] });
    return { denied: denied.status, installed: installed.status };
  });
}

test("PR14.3 AI Agent button, isolated output, language and removal",
  async ({ page }) => {
    await page.goto("/");
    const state = await installAgentUI(page);
    expect(state).toEqual({ denied: 403, installed: 201 });
    const button = page.locator(".plugin-extension-button");
    expect(await button.count()).toBe(1);
    const sibling = await button.evaluate(node =>
      node.previousElementSibling?.id);
    expect(sibling).toBe("explorerPowerShell");
    await button.click();
    const panel = page.locator(".plugin-extension-panel");
    await expect(panel).toBeVisible();
    const frame = page.frameLocator(".plugin-extension-frame");
    await expect(frame.getByText("連結本地 AI Agent")).toBeVisible();
    await expect(frame.getByText(
      "完成本地 Agent 配對與 MCP 授權後，可於此查看操作狀態與輸出。")).toBeVisible();
    await expect(frame.locator("textarea")).toHaveCount(0);

    const isolation = await page.evaluate(() => {
      const iframe = document.querySelector(
        ".plugin-extension-frame");
      let blocked = false;
      try { void iframe.contentWindow.document.body; }
      catch { blocked = true; }
      return {
        sandbox: iframe.getAttribute("sandbox"),
        blocked,
        sourceUrl: iframe.getAttribute("src")
      };
    });
    expect(isolation.sandbox).toBe("allow-scripts");
    expect(isolation.blocked).toBe(true);
    expect(isolation.sourceUrl).toBe(null);

    await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      await linkCore.request("ui", "LanguageManager",
        "set", { locale: "en" }, { origin: "user" });
    });
    await expect(frame.getByText("Connect local AI Agent"))
      .toBeVisible();
    await expect(frame.getByText(
      "Pair the Local Agent and authorize MCP to view operation status and output here."))
      .toBeVisible();

    const result = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const installer = linkCore.pluginHostInstaller;
      const providerId = "cluster.ai-agent-mcp";
      const disabled = installer.disable(providerId);
      const hidden = document.querySelector(
        ".plugin-extension-button").hidden;
      const enabled = installer.enable(providerId);
      const removed = installer.uninstall(providerId);
      return {
        disabled: disabled.status, hidden,
        enabled: enabled.status, removed: removed.status,
        remainingButtons: document.querySelectorAll(
          ".plugin-extension-button").length,
        remainingPanels: document.querySelectorAll(
          ".plugin-extension-panel").length
      };
    });
    expect(result).toEqual({
      disabled: 200, hidden: true,
      enabled: 200, removed: 200,
      remainingButtons: 0, remainingPanels: 0
    });
  });

test("PR14.3 no UI is mounted when consent is denied",
  async ({ page }) => {
    await page.goto("/");
    const state = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const response = await fetch(
        "/Implementation/plugins/ai-agent-mcp/plugin.json");
      const manifest = await response.text();
      return linkCore.pluginHostInstaller.install({
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: manifest, files: {}
      });
    });
    expect(state.status).toBe(400);
    await expect(page.locator(
      ".plugin-extension-button")).toHaveCount(0);
  });

test("PR14.3 failed UI-plugin upgrade restores previous view",
  async ({ page }) => {
    await page.goto("/");
    expect((await installAgentUI(page)).installed).toBe(201);
    const attempt = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const snapshot = structuredClone(window.__pr14TestSnapshot);
      snapshot.files["worker.js"] = btoa(
        "export const invalid = ;");
      const result = await linkCore.pluginHostInstaller.upgrade(
        "cluster.ai-agent-mcp", snapshot,
        { consented: true, approvedPermissions: ["network.request", "local-agent.pair",
      "model.configure", "model.task",
      "shell.execute", "mcp.read"] });
      const restored = linkCore.uru.getProvider(
        "cluster.ai-agent-mcp");
      return {
        status: result.status,
        restored: Boolean(restored),
        buttons: document.querySelectorAll(
          ".plugin-extension-button").length
      };
    });
    expect(attempt.restored).toBe(true);
    expect(attempt.buttons).toBe(1);
    expect(attempt.status).toBeGreaterThanOrEqual(400);
    await page.locator(".plugin-extension-button").click();
    await expect(page.frameLocator(".plugin-extension-frame")
      .getByText("連結本地 AI Agent")).toBeVisible();
  });

test("PR14.9 reinstall does not preserve ToolBox folder authority",
  async ({ page }) => {
    await page.goto("/");
    expect((await installAgentUI(page)).installed).toBe(201);
    await page.evaluate(() => {
      window.showDirectoryPicker = async () => ({
        kind: "directory", name: "Project",
        queryPermission: async () => "granted",
        requestPermission: async () => "granted"
      });
      window.prompt = () => ["C:", "Work", "Project"].join("\\\\");
    });
    await page.locator(".plugin-extension-button").click();
    await page.frameLocator(".plugin-extension-frame")
      .locator("[data-toolbox-toggle]").click();
    await page.getByRole("button", {
      name: /選取本地資料夾/
    }).click();
    await page.locator('[data-right="read"]').check();
    const before = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return linkCore.pluginHostInstaller.uiHost.views.get(
        "cluster.ai-agent-mcp").explorerAccess.status();
    });
    expect(before.selected).toBe(true);
    expect(before.permissions.read).toBe(true);
    const after = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const installer = linkCore.pluginHostInstaller;
      const id = "cluster.ai-agent-mcp";
      const disabled = installer.disable(id);
      const restored = installer.enable(id);
      const view = installer.uiHost.views.get(id);
      const reenabled = view.explorerAccess.status();
      const removed = installer.uninstall(id);
      const installed = await installer.install(
        window.__pr14TestSnapshot, {
          consented: true, approvedPermissions: [
            "network.request", "local-agent.pair",
            "model.configure", "model.task",
      "shell.execute", "mcp.read"
          ]
        });
      const next = installer.uiHost.views.get(id)
        .explorerAccess.status();
      return {
        disabled: disabled.status,
        restored: restored.status,
        removed: removed.status,
        installed: installed.status, reenabled, next
      };
    });
    expect(after.disabled).toBe(200);
    expect(after.restored).toBe(200);
    expect(after.removed).toBe(200);
    expect(after.installed).toBe(201);
    expect(after.reenabled.selected).toBe(false);
    expect(after.next.selected).toBe(false);
    expect(after.next.permissions.read).toBe(false);
    expect(after.next.permissions.ps).toBe(false);
  });
