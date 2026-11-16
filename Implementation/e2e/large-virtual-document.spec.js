import { test, expect } from "@playwright/test";

test("Patch18 opens a large OPFS file in the existing editor window",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(
        "pr8-patch18-large.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.truncate(65 * 1024 * 1024);
      await writer.write({
        type: "write", position: 0, data: "FIRST PAGE"
      });
      await writer.write({
        type: "write", position: 65536, data: "SECOND PAGE"
      });
      await writer.close();
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true,
        value: async () => [handle]
      });
    });
    await page.keyboard.press("Control+o");
    const editor = page.locator("#editor");
    await expect(editor).toHaveAttribute(
      "data-virtual-page-index", "0");
    await expect(editor).toHaveJSProperty("readOnly", false);
    const first = await editor.inputValue();
    expect(first.length).toBeLessThanOrEqual(65540);
    expect(first.startsWith("FIRST PAGE")).toBe(true);

    await editor.focus();
    await editor.press("Alt+PageDown");
    await expect(editor).toHaveAttribute(
      "data-virtual-page-index", "1");
    const second = await editor.inputValue();
    expect(second.length).toBeLessThanOrEqual(65540);
    expect(second.startsWith("SECOND PAGE")).toBe(true);
    await expect(editor).toHaveJSProperty("readOnly", false);

    const original = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle("pr8-patch18-large.txt");
      const file = await handle.getFile();
      const first = await file.slice(0, 10).text();
      const second = await file.slice(65536, 65547).text();
      return { size: file.size, first, second };
    });
    expect(original).toEqual({
      size: 65 * 1024 * 1024,
      first: "FIRST PAGE", second: "SECOND PAGE"
    });
  });
