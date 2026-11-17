import { test, expect } from "@playwright/test";

async function mountAgent(page) {
  const result = await page.evaluate(async () => {
    const { linkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const names = [
      "plugin.json", "worker.js", "index.html", "README.md",
      "locales/en.json", "locales/zh-Hant.json"
    ];
    const files = {};
    for (const name of names) {
      const response = await fetch(
        "/Implementation/plugins/ai-agent-mcp/" + name);
      const bytes = new Uint8Array(await response.arrayBuffer());
      files[name] = btoa(String.fromCharCode(...bytes));
    }
    const manifestText = new TextDecoder().decode(
      Uint8Array.from(atob(files["plugin.json"]),
        char => char.charCodeAt(0)));
    return linkCore.pluginHostInstaller.install({
      format: "cluster-plugin-folder", formatVersion: 1,
      manifestText, files
    }, {
      consented: true,
      approvedPermissions: [
        "network.request", "local-agent.pair", "model.configure",
        "model.task", "shell.execute", "mcp.read"
      ]
    });
  });
  expect(result.status).toBe(201);
}

test("PR16 workbench Agent tab switches cleanly with Plugin Manager",
  async ({ page }) => {
    await page.goto("/");
    await mountAgent(page);
    await expect(page.locator(".plugin-agent-tab")).toHaveCount(0);
    const button = page.locator(".plugin-extension-button");
    expect(await button.evaluate(node =>
      node.previousElementSibling?.id)).toBe("explorerPowerShell");
    await button.click();
    await expect(page.locator(".plugin-agent-tab")).toHaveCount(1);
    await expect(page.locator(".plugin-extension-panel")).toBeVisible();
    await expect(page.locator("#pluginWindow")).toBeHidden();

    await page.locator("#menuBtn").click();
    await page.locator("#toolBtn").click();
    await page.locator("#pluginBtn").click();
    await expect(page.locator("#pluginWindow")).toBeVisible();
    await expect(page.locator(".plugin-extension-panel")).toBeHidden();
    await page.locator(".plugin-agent-tab").click();
    await expect(page.locator("#pluginWindow")).toBeHidden();
    await expect(page.locator(".plugin-extension-panel")).toBeVisible();

    await page.locator(".plugin-agent-tab .close").click();
    await expect(page.locator(".plugin-agent-tab")).toHaveCount(0);
    await expect(page.locator(".plugin-extension-panel")).toBeHidden();
  });

test("PR16 legacy setup to runtime, guide and quick-setup ZIP",
  async ({ page }) => {
    await page.goto("/");
    await mountAgent(page);
    await page.locator(".plugin-extension-button").click();
    const frame = page.frameLocator(".plugin-extension-frame");
    await expect(frame.locator("#caiSetup")).toBeVisible();
    await expect(frame.locator("#caiWorkspace")).toBeHidden();
    await expect(frame.locator(".cai-bar")).toBeVisible();
    const downloading = page.waitForEvent("download");
    await frame.locator("[data-quick-setup]").click();
    expect((await downloading).suggestedFilename())
      .toBe("ClusterOpt2-AI-Agent-MCP.zip");

    await page.evaluate(() => {
      const frame = document.querySelector(
        ".plugin-extension-frame");
      frame.contentWindow.postMessage({
        type: "cluster-local-agent-status",
        state: "connected"
      }, "*");
    });
    await expect(frame.locator("#caiSetup")).toBeHidden();
    await expect(frame.locator("#caiWorkspace")).toBeVisible();
    await expect(frame.locator("#caiForm textarea")).toBeEnabled();
    await frame.locator("[data-legacy-guide]").click();
    await expect(frame.locator("#caiConnectGuide")).toBeVisible();
    await frame.locator("[data-guide-dismiss]").click();
    await expect(frame.locator("#caiConnectGuide")).toBeHidden();
    await frame.locator("[data-legacy-close]").click();
    await expect(page.locator(".plugin-agent-tab")).toHaveCount(0);
  });

test("PR16 ToolBox remains a trusted host menu and does not cover header",
  async ({ page }) => {
    await page.goto("/");
    await mountAgent(page);
    await page.locator(".plugin-extension-button").click();
    const menu = page.locator(".plugin-agent-toolbox");
    await menu.locator(":scope > button").click();
    await expect(menu.getByText("TOOLBOX  /  LOCAL ACCESS"))
      .toBeVisible();
    await expect(menu.locator("[data-right]")).toHaveCount(6);
    const positions = await page.evaluate(() => {
      const frame = document.querySelector(
        ".plugin-extension-frame").getBoundingClientRect();
      const toolbox = document.querySelector(
        ".plugin-agent-toolbox").getBoundingClientRect();
      return { frameTop: frame.top, toolboxTop: toolbox.top };
    });
    expect(positions.toolboxTop - positions.frameTop)
      .toBeGreaterThanOrEqual(50);
  });

test("PR16 switching PowerShell and AI does not create extra sessions",
  async ({ page }) => {
    await page.goto("/");
    await mountAgent(page);
    await page.locator("#explorerPowerShell").click();
    await expect(page.locator("#clusterEditorColumn"))
      .toHaveClass(/psm-mode/);
    await expect(page.locator(".psm-tab")).toHaveCount(1);

    await page.locator(".plugin-extension-button").click();
    await expect(page.locator("#powershellManagerPane")).toBeHidden();
    await expect(page.locator(".plugin-extension-panel")).toBeVisible();
    await expect(page.locator(".plugin-agent-tab")).toHaveCount(1);
    await expect(page.locator(".psm-tab")).toHaveCount(1);

    await page.locator(".psm-tab").click();
    await expect(page.locator("#clusterEditorColumn"))
      .toHaveClass(/psm-mode/);
    await expect(page.locator(".plugin-extension-panel")).toBeHidden();

    await page.locator(".plugin-agent-tab").click();
    await expect(page.locator(".plugin-extension-panel")).toBeVisible();
    await expect(page.locator(".psm-tab")).toHaveCount(1);
  });
