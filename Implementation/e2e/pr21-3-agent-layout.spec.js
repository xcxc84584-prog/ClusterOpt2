import { test, expect } from "@playwright/test";

// Install only in a test context. Production must not auto-grant the
// listed capabilities; the explicit consent is part of this fixture.
async function mountAgent(page) {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { linkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const files = {};
    for (const name of ["plugin.json", "worker.js", "index.html",
      "README.md", "locales/en.json", "locales/zh-Hant.json"]) {
      const response = await fetch(
        "/Implementation/plugins/ai-agent-mcp/" + name);
      if (!response.ok) throw Error("Missing fixture: " + name);
      const bytes = new Uint8Array(await response.arrayBuffer());
      files[name] = btoa(String.fromCharCode(...bytes));
    }
    const manifestText = new TextDecoder().decode(
      Uint8Array.from(atob(files["plugin.json"]),
        c => c.charCodeAt(0)));
    return linkCore.pluginHostInstaller.install({
      format: "cluster-plugin-folder", formatVersion: 1,
      manifestText, files
    }, { consented: true, approvedPermissions: [
      "network.request", "local-agent.pair",
      "model.configure", "model.task",
      "shell.execute", "mcp.read"
    ] });
  });
  expect(result.status).toBe(201);
  await page.locator(".plugin-extension-button").click();
  return page.frameLocator(".plugin-extension-frame");
}

test("PR21.3 full width setup and single right edge scrollbar",
  async ({ page }) => {
    for (const width of [420, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      const frame = width === 420 ? await mountAgent(page) :
        page.frameLocator(".plugin-extension-frame");
      const measures = await frame.locator("#clusterAiPanel")
        .evaluate(panel => {
          const setup = panel.querySelector("#caiSetup");
          const a = panel.getBoundingClientRect();
          const b = setup.getBoundingClientRect();
          return {
            panelWidth: a.width, setupWidth: b.width,
            scrollX: panel.scrollWidth - panel.clientWidth,
            panelOverflowY: getComputedStyle(panel).overflowY,
            setupOverflowY: getComputedStyle(setup).overflowY,
            rightGap: a.right - b.right
          };
        });
      expect(measures.panelWidth).toBeGreaterThan(200);
      expect(measures.setupWidth).toBeGreaterThan(
        measures.panelWidth * 0.92);
      expect(measures.scrollX).toBe(0);
      expect(measures.panelOverflowY).toBe("auto");
      expect(measures.setupOverflowY).not.toBe("auto");
      expect(Math.abs(measures.rightGap)).toBeLessThan(32);
    }
  });

test("PR21.3 guide stays in the same iframe and supports dismissal",
  async ({ page }) => {
    const frame = await mountAgent(page);
    const initial = await page.locator(
      ".plugin-extension-frame").count();
    await frame.locator("[data-legacy-guide]").click();
    await expect(frame.locator("#caiSetup")).toBeVisible();
    await expect(frame.locator("#caiConnectGuide")).toBeVisible();
    await expect(frame.locator("[data-package-download]")).toBeVisible();
    expect(await page.locator(".plugin-extension-frame").count())
      .toBe(initial);
    await frame.locator("[data-guide-dismiss]").click();
    await expect(frame.locator("#caiConnectGuide")).toBeHidden();
  });

test("PR21.3 ToolBox closes on sandbox outside click but remains usable",
  async ({ page }) => {
    const frame = await mountAgent(page);
    const trigger = frame.locator("[data-toolbox-toggle]");
    const menu = page.locator(".plugin-agent-toolbox > div");
    await trigger.click();
    await expect(menu).toBeVisible();
    await frame.locator("#caiSetup h2").click();
    await expect(menu).toBeHidden();
    await trigger.click();
    await expect(menu).toBeVisible();
    await menu.locator('input[type="checkbox"]').first().count();
    await frame.locator("#caiSetup h2").press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
