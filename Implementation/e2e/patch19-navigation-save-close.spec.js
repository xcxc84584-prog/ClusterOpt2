import { test, expect } from "@playwright/test";

test("Patch19 fix: backward page enters at last line; forward at first",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(
        "patch19-navigation.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.truncate(65 * 1024 * 1024);
      await writer.write({
        type: "write", position: 0, data: "PAGE ONE\n"
      });
      await writer.write({
        type: "write", position: 65536,
        data: "SECOND\nTHIRD\nFOURTH"
      });
      await writer.close();
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true, value: async () => [handle]
      });
    });
    await page.keyboard.press("Control+o");
    const editor = page.locator("#editor");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
    await editor.focus();
    await editor.press("Alt+PageDown");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "1");
    expect(await editor.evaluate(element => element.selectionStart))
      .toBe(0);
    await editor.press("Alt+PageUp");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
    expect(await editor.evaluate(element => element.selectionStart))
      .toBe((await editor.inputValue()).length);
    await editor.press("Alt+PageDown");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "1");
    expect(await editor.evaluate(element => element.selectionStart))
      .toBe(0);
  });

test("Patch19 fix: actual 65 MiB document can save and close safely",
  async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(
        "patch19-write-close.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.truncate(65 * 1024 * 1024);
      await writer.write({
        type: "write", position: 0, data: "ORIGINAL"
      });
      await writer.close();
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true, value: async () => [handle]
      });
    });
    await page.keyboard.press("Control+o");
    const editor = page.locator("#editor");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
    await expect(editor).toHaveJSProperty("readOnly", false);
    await expect.poll(async () => (await editor.inputValue()).length)
      .toBe(65536);
    const originalPage = await editor.inputValue();
    expect(originalPage.startsWith("ORIGINAL")).toBe(true);
    await editor.fill("REPLACED" +
      originalPage.slice("ORIGINAL".length));
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
    await page.keyboard.press("Control+s");
    await expect(page.locator("#statusLamp"), "verified large save")
      .toHaveClass(/green/, { timeout: 90000 });
    const disk = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle("patch19-write-close.txt");
      const file = await handle.getFile();
      return { size: file.size, prefix: await file.slice(0, 8).text() };
    });
    expect(disk).toEqual({
      size: 65 * 1024 * 1024, prefix: "REPLACED"
    });
    await page.locator(".tab.active .close").click();
    await expect(page.locator(".tab.active")).toHaveCount(0);
  });

test("Patch19 fix: closing dirty large file saves only on confirmation",
  async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(
        "patch19-dirty-close.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.truncate(65 * 1024 * 1024);
      await writer.write("INITIAL!");
      await writer.close();
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true, value: async () => [handle]
      });
    });
    await page.keyboard.press("Control+o");
    const editor = page.locator("#editor");
    await expect.poll(async () => (await editor.inputValue()).length)
      .toBe(65536);
    const original = await editor.inputValue();
    await editor.fill("MODIFIED" + original.slice(8));
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);

    // Cancel must keep the editor and journal intact.
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator(".tab.active .close").click();
    await expect(page.locator(".tab.active")).toHaveCount(1);
    await expect(editor).toHaveValue(/^MODIFIED/);

    // Confirm must perform a verified writeback before removing tab.
    page.once("dialog", dialog => dialog.accept());
    await page.locator(".tab.active .close").click();
    await expect(page.locator(".tab.active"))
      .toHaveCount(0, { timeout: 90000 });
    const disk = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(
        "patch19-dirty-close.txt");
      const file = await handle.getFile();
      return { size: file.size, prefix: await file.slice(0, 8).text() };
    });
    expect(disk).toEqual({
      size: 65 * 1024 * 1024, prefix: "MODIFIED"
    });
  });
