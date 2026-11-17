import { test, expect } from "@playwright/test";

test("PR8+25 legacy folder context creates a real local file",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const folder = await root.getDirectoryHandle(
        "pr8-patch25-folder", { create: true });
      Object.defineProperty(window, "showDirectoryPicker", {
        configurable: true, value: async () => folder
      });
      Object.defineProperty(window, "prompt", {
        configurable: true, value: () => "created-from-context.txt"
      });
    });
    await page.locator("#explorerToggle").click();
    await page.locator("#explorerAddFolder").click();
    const root = page.locator(".explorer-entry").filter({
      hasText: "pr8-patch25-folder"
    }).first();
    await expect(root).toBeVisible();
    await root.click({ button: "right" });
    const toolbar = page.locator(".explorer-inline-actions");
    await expect(toolbar.locator("button")).toHaveCount(4);
    await expect(toolbar.locator('[data-action="file"]')).toBeEnabled();
    await toolbar.locator('[data-action="file"]').click();
    const file = await page.evaluate(async () => {
      const storage = await navigator.storage.getDirectory();
      const folder = await storage.getDirectoryHandle(
        "pr8-patch25-folder");
      const handle = await folder.getFileHandle(
        "created-from-context.txt");
      return { name: handle.name, size: (await handle.getFile()).size };
    });
    expect(file).toEqual({
      name: "created-from-context.txt", size: 0
    });
    await expect(page.locator(".explorer-entry").filter({
      hasText: "created-from-context.txt"
    })).toHaveCount(1);
  });
