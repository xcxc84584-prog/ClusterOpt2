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
    const denied = await linkCore.pluginHostInstaller.install(snapshot);
    const installed = await linkCore.pluginHostInstaller.install(
      snapshot, { consented: true, approvedPermissions: [] });
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
      "AI 模型與任務服務尚未啟用。")).toBeVisible();
    await expect(frame.locator("textarea")).toBeDisabled();

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
      "AI models and task execution are not enabled yet."))
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
