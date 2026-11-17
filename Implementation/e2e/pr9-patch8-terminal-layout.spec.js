import { test, expect } from "@playwright/test";

test("PR9 native terminal stays inside the editor and above status UI",
  async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 680 });
    await page.goto("/");
    await page.locator("#explorerPowerShell").click();

    // Render connected-mode geometry without running a real OS shell.
    await page.evaluate(() => {
      const pane = document.querySelector("#powershellManagerPane");
      pane.classList.add("psm-connected");
      pane.querySelector(".psm-body").hidden = true;
      pane.querySelector(".psm-terminal").hidden = false;
      const wrap = pane.querySelector(".psm-native-wrap");
      wrap.hidden = false;
      const terminal = document.createElement("div");
      terminal.className = "psm-native-session";
      terminal.style.cssText = "width:100%;height:100%;";
      terminal.innerHTML =
        '<div class="xterm" style="width:100%;height:100%">' +
        '<div class="xterm-screen">PS test&gt;</div>' +
        '<div class="xterm-viewport"></div></div>';
      wrap.append(terminal);
    });

    const metrics = await page.evaluate(() => {
      const bbox = selector => {
        const rect = document.querySelector(selector)
          .getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom,
          height: rect.height };
      };
      return {
        pane: bbox("#powershellManagerPane"),
        header: bbox(".psm-terminal-head"),
        wrap: bbox(".psm-native-wrap"),
        footer: bbox(".statusbar"),
        oldInput: getComputedStyle(document.querySelector(
          ".psm-terminal-output")).display
      };
    });
    expect(metrics.wrap.height).toBeGreaterThan(40);
    expect(metrics.wrap.top).toBeGreaterThanOrEqual(
      metrics.header.bottom - 1);
    expect(metrics.wrap.bottom).toBeLessThanOrEqual(
      metrics.pane.bottom + 1);
    expect(metrics.wrap.bottom).toBeLessThanOrEqual(
      metrics.footer.top + 1);
    expect(metrics.oldInput).toBe("none");
  });
