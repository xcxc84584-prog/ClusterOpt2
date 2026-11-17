import { test, expect } from "@playwright/test";

test("PR9 native terminal session tabs do not replace editor bytes",
  async ({ page }) => {
    await page.goto("/");
    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    await page.locator("#editor").fill("persistent editor bytes");
    await page.locator("#menuBtn").click();
    await page.locator("#toolBtn").click();
    await page.locator("#nativePowerShellBtn").click();
    await expect(page.locator("#nativePowerShellPane")).toBeVisible();
    await expect(page.locator("#nativePsTabs button")).toHaveCount(2);
    await page.locator("#nativePsNew").click();
    await expect(page.locator("#nativePsTabs button")).toHaveCount(4);
    await expect(page.locator("#editor")).toHaveValue(
      "persistent editor bytes");
    await page.locator("#nativePsTabs button").last().click();
    await expect(page.locator("#nativePsTabs button")).toHaveCount(2);
    await page.locator("#nativePsHide").click();
    await expect(page.locator("#nativePowerShellPane")).toBeHidden();
    await expect(page.locator("#editor")).toHaveValue(
      "persistent editor bytes");
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
