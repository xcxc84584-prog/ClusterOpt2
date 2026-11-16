import { test, expect } from "@playwright/test";

test("PR8+21 restores physical viewport after switching and reload",
  async ({ page }) => {
    await page.goto("/");
    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    const editor = page.locator("#editor");
    const body = Array.from({ length: 300 },
      (_, index) => "row_" + index + " " + "x".repeat(140)).join("\n");
    await editor.fill(body);
    await editor.evaluate(node => {
      node.scrollTop = 720;
      node.scrollLeft = 120;
      node.dispatchEvent(new Event("scroll"));
    });
    const first = await editor.evaluate(node => ({
      top: node.scrollTop, left: node.scrollLeft
    }));
    expect(first.top).toBeGreaterThan(0);

    await page.locator("#menuBtn").click();
    await page.locator("#newFile").click();
    await page.locator("#tabs .tab").first().click();
    await expect.poll(() => editor.evaluate((node, expectedTop) =>
      Math.abs(node.scrollTop - expectedTop) <= 3, first.top)).toBe(true);

    // IndexedDB and fallback persistence share the same snapshot data.
    await expect.poll(() => page.evaluate(() => {
      const raw = sessionStorage.getItem("clusteropt2.recovery.fallback");
      if (!raw) return false;
      const state = JSON.parse(raw);
      return state.documents?.some(doc => doc.scrollTop >= 700);
    })).toBe(true);
    await page.reload();
    await expect(editor).toHaveValue(body);
    await expect.poll(() => editor.evaluate((node, expectedTop) =>
      Math.abs(node.scrollTop - expectedTop) <= 3, first.top)).toBe(true);
  });
