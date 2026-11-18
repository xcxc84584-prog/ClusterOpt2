import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

test("PR17 legacy setup offers a standalone quick-setup CMD",
  async ({ page }) => {
    await page.goto("/");
    await mountAgent(page);
    await page.locator(".plugin-extension-button").click();
    const frame = page.frameLocator(".plugin-extension-frame");
    await expect(frame.locator("#caiSetup")).toBeVisible();
    await expect(frame.locator("#caiWorkspace")).toBeHidden();
    await expect(frame.locator(".cai-bar")).toBeVisible();
    await expect(frame.locator("[data-model-action]")).toHaveCount(0);
    await frame.locator("[data-legacy-guide]").click();
    await expect(frame.locator("#caiConnectGuide")).toHaveCount(0);
    const bundleDownload = page.waitForEvent("download");
    await frame.locator("[data-package-download]").click();
    const bundle = await bundleDownload;
    expect(bundle.suggestedFilename())
      .toBe("ClusterOpt2-AI-Agent-MCP.zip");
    const bytes = await readFile(await bundle.path());
    expect(bytes.subarray(0, 2).toString("hex")).toBe("504b");
    const downloading = page.waitForEvent("download");
    await frame.locator("#caiSetup [data-quick-setup]").click();
    const downloaded = await downloading;
    expect(downloaded.suggestedFilename())
      .toBe("AI-Agent-MCP-Quick-Setup.cmd");
    const cmd = await readFile(await downloaded.path(), "utf8");
    expect(cmd).toContain("SourceRevision");
    expect(cmd).toContain("Setup-Quick.ps1");
    const mcpDownloading = page.waitForEvent("download");
    await frame.locator("#caiSetup [data-mcp-quick-setup]").click();
    const mcpDownload = await mcpDownloading;
    expect(mcpDownload.suggestedFilename())
      .toBe("AI-Agent-MCP-Quick-Connect.cmd");
    const mcpCmd = await readFile(await mcpDownload.path(), "utf8");
    expect(mcpCmd).toContain("Start-MCP.ps1");
    expect(mcpCmd).toContain("Start-OAuth.ps1");

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
    await expect(frame.locator("#caiForm")).toHaveCount(0);
    await expect(frame.locator(".cai-readonly-note")).toBeVisible();
    await frame.locator("[data-legacy-guide]").click();
    await expect(frame.locator("#caiSetup")).toBeVisible();
    await expect(frame.locator("#caiConnectGuide")).toHaveCount(0);
    await frame.locator("[data-return-workspace]").click();
    await expect(frame.locator("#caiWorkspace")).toBeVisible();
    await frame.locator("[data-legacy-close]").click();
    await expect(page.locator(".plugin-agent-tab")).toHaveCount(0);
  });

test("PR16 ToolBox remains a trusted host menu and does not cover header",
  async ({ page }) => {
    await page.goto("/");
    await mountAgent(page);
    await page.locator(".plugin-extension-button").click();
    const menu = page.locator(".plugin-agent-toolbox");
    const button = page.frameLocator(".plugin-extension-frame")
      .locator("[data-toolbox-toggle]");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
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
    await page.setViewportSize({ width: 420, height: 720 });
    const frame = page.frameLocator(".plugin-extension-frame");
    const barHeight = await frame.locator(".cai-bar")
      .evaluate(node => node.getBoundingClientRect().height);
    await expect.poll(() => page.evaluate(() => {
      const panel = document.querySelector(".plugin-extension-panel");
      const menu = document.querySelector(
        ".plugin-agent-toolbox > div");
      const area = panel.getBoundingClientRect();
      const bounds = menu.getBoundingClientRect();
      return {
        xSafe: bounds.left >= area.left &&
          bounds.right <= area.right + 2,
        top: bounds.top - area.top
      };
    })).toMatchObject({
      xSafe: true, top: expect.any(Number)
    });
    const bounds = await page.locator(
      ".plugin-agent-toolbox > div").boundingBox();
    const area = await page.locator(
      ".plugin-extension-panel").boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(
      area.y + barHeight - 3);
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
