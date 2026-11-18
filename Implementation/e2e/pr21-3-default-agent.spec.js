import { test, expect } from "@playwright/test";

test("PR21.3 bundled Agent is offered without any implicit grants",
  async ({ page }) => {
    await page.goto("/");
    const launcher = page.locator("#pluginBundledAgentLauncher");
    await expect(launcher).toBeVisible();
    const before = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return {
        registered: Boolean(linkCore.uru.getProvider("cluster.ai-agent-mcp")),
        shell: linkCore.checkPluginPermission(
          "cluster.ai-agent-mcp", "shell.execute")
      };
    });
    expect(before.registered).toBe(false);
    expect(before.shell).toBe(false);
    await expect(page.locator(".plugin-extension-button")).toHaveCount(0);
  });

test("PR21.3 opt-out survives reload; no silent plugin restart",
  async ({ page }) => {
    await page.goto("/");
    const launcher = page.locator("#pluginBundledAgentLauncher");
    await expect(launcher).toBeVisible();
    await launcher.getByRole("button", {
      name: "Disable default AI Agent"
    }).click();
    await expect(launcher).toHaveCount(0);
    await page.reload();
    await expect(launcher).toHaveCount(0);
    await expect(page.locator(".plugin-extension-button")).toHaveCount(0);
  });

test("PR21.3 explicit activation creates an isolated provider",
  async ({ page }) => {
    await page.goto("/");
    const launcher = page.locator("#pluginBundledAgentLauncher");
    await expect(launcher).toBeVisible();
    page.on("dialog", dialog => dialog.accept());
    await launcher.getByRole("button", { name: /AI Agent/ }).click();
    await expect(page.locator(".plugin-extension-button")).toHaveCount(1);
    await expect(launcher).toHaveCount(0);
    const state = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return {
        registered: Boolean(linkCore.uru.getProvider("cluster.ai-agent-mcp")),
        sandbox: linkCore.pluginHostInstaller.handles.has(
          "cluster.ai-agent-mcp")
      };
    });
    expect(state).toEqual({ registered: true, sandbox: true });
    await page.reload();
    // Approval is per activation, even though the launcher remains saved.
    await expect(page.locator("#pluginBundledAgentLauncher")).toBeVisible();
    await expect(page.locator(".plugin-extension-button")).toHaveCount(0);
  });
