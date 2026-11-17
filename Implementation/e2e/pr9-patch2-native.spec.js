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

test("PR9 Go to Line dialog stays above status bar",
  async ({ page }) => {
    await page.goto("/");
    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    await page.locator("#editor").fill("one\ntwo\nthree");
    await page.locator("#goToLineBtn").click();
    const dialog = page.locator("#goToLineDialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    const footer = await page.locator(".statusbar").boundingBox();
    expect(bounds).toBeTruthy();
    expect(footer).toBeTruthy();
    expect(bounds.y + bounds.height).toBeLessThan(footer.y);
    await page.locator("#goToLineInput").fill("3");
    await page.locator("#goToLineSubmit").click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("#editor")).toHaveValue("one\ntwo\nthree");
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
