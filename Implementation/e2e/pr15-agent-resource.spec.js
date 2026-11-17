import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { AI_AGENT_PACKAGE_FILES } from
  "../main/plugin-agent-download.js";

test("PR15.1 AI Agent is searchable and publishes the full ZIP",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const { renderResources } = await import(
        "/Implementation/main/plugin-resource-view.js");
      const host = document.createElement("div");
      host.id = "pr15-resources";
      document.body.append(host);
      renderResources(document, host, {
        t: zh => zh,
        settings: document.createElement("div"),
        apiEntries: () => [],
        logs: () => [],
        providers: () => [],
        core: {
          localPluginPackage: {
            selectAndStage: async () => {
              window.__pr15FolderSelections =
                (window.__pr15FolderSelections ?? 0) + 1;
              return { ok: false, status: 403 };
            }
          },
          edpmu: { get: () => "zh-Hant" }
        }
      });
    });
    const panel = page.locator("#pr15-resources");
    await expect(panel.getByText("AI Agent MCP（ChatGPT）"))
      .toBeVisible();
    await panel.locator("#pluginResourceSearch").fill("agent");
    await expect(panel.locator(".pm-resource-card")).toHaveCount(1);
    const downloading = page.waitForEvent("download");
    await panel.locator("#pluginAgentDownload").click();
    const download = await downloading;
    expect(download.suggestedFilename())
      .toBe("ClusterOpt2-AI-Agent-MCP.zip");
    const bytes = await readFile(await download.path());
    const files = new Map();
    let cursor = 0;
    while (bytes.readUInt32LE(cursor) === 0x04034b50) {
      const nameSize = bytes.readUInt16LE(cursor + 26);
      const extraSize = bytes.readUInt16LE(cursor + 28);
      const size = bytes.readUInt32LE(cursor + 18);
      const name = bytes.subarray(cursor + 30, cursor + 30 + nameSize)
        .toString("utf8");
      const start = cursor + 30 + nameSize + extraSize;
      files.set(name, bytes.subarray(start, start + size));
      cursor = start + size;
    }
    expect(files.size).toBe(AI_AGENT_PACKAGE_FILES.length);
    expect(JSON.parse(files.get("plugin.json").toString("utf8"))
      .provider.providerId).toBe("cluster.ai-agent-mcp");
    expect(files.has("local-agent/server.cjs")).toBe(true);
    expect(files.has("local-agent/Start-OAuth.ps1")).toBe(true);
    expect(files.has("local-agent/Quick-Setup.cmd")).toBe(true);
    expect(files.has("local-agent/Setup-Quick.ps1")).toBe(true);
    expect(files.has("local-agent/Port-CPO.ps1")).toBe(true);
    expect(files.has("local-agent/MCP-Quick-Setup.cmd")).toBe(true);

    await panel.locator("#pluginAgentMount").click();
    await expect(panel.locator(".pm-market-status"))
      .toContainText("403");
    expect(await page.evaluate(() => window.__pr15FolderSelections))
      .toBe(1);
  });
