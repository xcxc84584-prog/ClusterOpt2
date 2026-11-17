import { test, expect } from "@playwright/test";

test("PR9 legacy PowerShell appears next to Explorer, not File Tool",
  async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#nativePowerShellBtn")).toHaveCount(0);
    const explorer = await page.locator("#explorerToggle").boundingBox();
    const power = await page.locator("#explorerPowerShell").boundingBox();
    expect(explorer).toBeTruthy();
    expect(power).toBeTruthy();
    expect(power.x).toBeGreaterThan(explorer.x);
    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    await page.locator("#editor").fill("persistent editor bytes");
    await page.locator("#explorerPowerShell").click();
    await expect(page.locator("#powershellManagerPane")).toBeVisible();
    await expect(page.locator("#tabs .psm-tab")).toHaveCount(1);
    await expect(page.locator("#psmAgentPort")).toBeVisible();
    await expect(page.locator("#psmPairToken")).toBeVisible();
    await page.locator("#explorerPowerShell").click();
    await expect(page.locator("#tabs .psm-tab")).toHaveCount(2);
    await page.locator("#tabs .tab:not(.psm-tab)").first().click();
    await expect(page.locator("#editor")).toHaveValue(
      "persistent editor bytes");
    await expect(page.locator("#powershellManagerPane")).toBeHidden();
  });

test("PR9 legacy Go to Line row never obscures the editor or footer",
  async ({ page }) => {
    await page.goto("/");
    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    await page.locator("#editor").fill("one\ntwo\nthree");
    await expect(page.locator("#goToLineDialog")).toHaveCount(0);
    const jump = page.locator("#goLineBar");
    const workspace = page.locator("#clusterWorkspaceShell");
    const footer = page.locator(".statusbar");
    const [bar, main, bottom] = await Promise.all([
      jump.boundingBox(), workspace.boundingBox(), footer.boundingBox()
    ]);
    expect(bar).toBeTruthy();
    expect(main).toBeTruthy();
    expect(bottom).toBeTruthy();
    expect(bar.y).toBeGreaterThanOrEqual(
      main.y + main.height - 1);
    expect(bar.y + bar.height).toBeLessThanOrEqual(bottom.y + 1);
    await page.locator("#goLineInput").fill("3");
    await page.locator("#goLineButton").click();
    await expect(page.locator("#position")).toContainText("Ln 3");
    await expect(page.locator("#editor")).toHaveValue("one\ntwo\nthree");
    await page.keyboard.press("Control+g");
    await expect(page.locator("#goLineInput")).toBeFocused();
  });

test("PR9 restores legacy setup wizard and terminal controls",
  async ({ page }) => {
    await page.goto("/");
    await page.locator("#explorerPowerShell").click();
    await expect(page.locator("#powershellManagerPane")).toBeVisible();
    await expect(page.locator(".psm-intro")).toBeVisible();
    await expect(page.locator(".psm-setup-step")).toHaveCount(3);
    await expect(page.locator('[data-psm-action="download"]'))
      .toBeVisible();
    await expect(page.locator('[data-psm-action="check"]'))
      .toBeVisible();
    await page.locator('[data-psm-action="tool"]').click();
    await expect(page.locator(".psm-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".psm-menu")).toBeHidden();
    await expect(page.locator(".psm-terminal-head")).toHaveCount(1);
    await expect(page.locator(".psm-native-wrap")).toHaveCount(1);
  });
