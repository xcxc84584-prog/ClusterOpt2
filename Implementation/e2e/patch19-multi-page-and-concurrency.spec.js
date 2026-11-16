import { test, expect } from "@playwright/test";

test("PR8 Fix4: Explorer, file picker, and tabs work during slow Save",
  async ({ page }) => {
    test.setTimeout(180000);
    await page.goto("/");
    await page.evaluate(async () => {
      const dir = await navigator.storage.getDirectory();
      const large = await dir.getFileHandle(
        "concurrent-large.txt", { create: true });
      const writer = await large.createWritable();
      await writer.truncate(65 * 1024 * 1024);
      await writer.write("ORIGINAL");
      await writer.close();
      const other = await dir.getFileHandle(
        "concurrent-other.txt", { create: true });
      const small = await other.createWritable();
      await small.write("another editor");
      await small.close();
      const third = await dir.getFileHandle(
        "concurrent-third.txt", { create: true });
      const thirdWriter = await third.createWritable();
      await thirdWriter.write("new file while saving");
      await thirdWriter.close();
      const delayed = {
        name: large.name, kind: "file",
        getFile: () => large.getFile(),
        isSameEntry: async value => value === delayed,
        async createWritable(options) {
          const result = await large.createWritable(options);
          return {
            async write(value) {
              await new Promise(resolve => setTimeout(resolve, 20));
              return result.write(value);
            },
            close: () => result.close(),
            abort: () => result.abort()
          };
        }
      };
      let picks = 0;
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true,
        value: async () => ++picks === 1 ?
          [delayed, other] : [third]
      });
    });
    await page.keyboard.press("Control+o");
    await page.locator(".tab").filter({
      hasText: "concurrent-large.txt"
    }).click();
    const editor = page.locator("#editor");
    await expect.poll(async () => (await editor.inputValue()).length)
      .toBe(65536);
    const initial = await editor.inputValue();
    await editor.fill("REPLACED!" + initial.slice(8));
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
    await page.locator("#explorerToggle").click();
    await expect(page.locator(".explorer-entry").first()).toBeVisible();
    await page.keyboard.press("Control+s");
    await expect(page.locator("#statusLamp")).toHaveClass(/blue/);
    await page.locator(".explorer-entry").filter({
      hasText: "concurrent-other.txt"
    }).click({ button: "right" });
    await expect(page.locator(".explorer-inline-actions"))
      .toBeVisible({ timeout: 4000 });
    await page.keyboard.press("Control+o");
    await expect(page.locator(".tab").filter({
      hasText: "concurrent-third.txt"
    })).toHaveCount(1, { timeout: 5000 });
    await page.locator(".tab").filter({
      hasText: "concurrent-other.txt"
    }).click();
    await expect(editor).toHaveValue("another editor");
    await editor.fill("edited while other document saves");
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
    await page.locator(".tab").filter({
      hasText: "concurrent-large.txt"
    }).click();
    await expect(page.locator("#statusLamp"))
      .toHaveClass(/green/, { timeout: 90000 });
    const disk = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle("concurrent-large.txt");
      const file = await handle.getFile();
      return { size: file.size, head: await file.slice(0, 9).text() };
    });
    expect(disk).toEqual({
      size: 65 * 1024 * 1024 + 1, head: "REPLACED!"
    });
  });

test("PR8 Fix4: real OPFS two-page unsaved edits then one Save",
  async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/");
    await page.evaluate(async () => {
      const dir = await navigator.storage.getDirectory();
      const handle = await dir.getFileHandle(
        "two-unsaved-pages.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.truncate(65 * 1024 * 1024);
      await writer.write({
        type: "write", position: 0, data: "FIRST!\n"
      });
      await writer.write({
        type: "write", position: 65536, data: "SECOND\n"
      });
      await writer.close();
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true, value: async () => [handle]
      });
    });
    await page.keyboard.press("Control+o");
    const editor = page.locator("#editor");
    await expect.poll(async () => (await editor.inputValue()).length)
      .toBe(65536);
    const one = await editor.inputValue();
    await editor.fill("CHANGE\n" + one.slice(7));
    await editor.press("Alt+PageDown");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "1");
    const two = await editor.inputValue();
    await editor.fill("ALTER!\n" + two.slice(7));
    await editor.press("Alt+PageUp");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
    await expect(editor).toHaveValue(/^CHANGE/);
    await page.keyboard.press("Control+s");
    await expect(page.locator("#statusLamp"))
      .toHaveClass(/green/, { timeout: 90000 });
    const saved = await page.evaluate(async () => {
      const dir = await navigator.storage.getDirectory();
      const file = await (await dir.getFileHandle(
        "two-unsaved-pages.txt")).getFile();
      return {
        size: file.size,
        first: await file.slice(0, 7).text(),
        second: await file.slice(65536, 65543).text()
      };
    });
    expect(saved).toEqual({
      size: 65 * 1024 * 1024,
      first: "CHANGE\n", second: "ALTER!\n"
    });
  });
