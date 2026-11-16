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
    await expect.poll(() => editor.evaluate(node =>
      Math.abs(node.scrollTop - first.top) <= 3)).toBe(true);

    // Recovery writes are debounced; wait for persisted snapshot.
    await expect.poll(() => page.evaluate(async () => {
      const open = indexedDB.open("clusteropt2-recovery");
      return new Promise(resolve => {
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          open.result.close();
          resolve(true);
        };
      });
    })).toBe(true);
    await page.waitForTimeout(650);
    await page.reload();
    await expect(editor).toHaveValue(body);
    await expect.poll(() => editor.evaluate(node =>
      Math.abs(node.scrollTop - first.top) <= 3)).toBe(true);
  });
