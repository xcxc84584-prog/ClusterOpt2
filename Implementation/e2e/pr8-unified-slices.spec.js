import { test, expect } from "@playwright/test";

test("PR8 all real file sizes use the same bounded virtual editor", async ({
  page
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(
      "pr8-uniform-small.txt", { create: true });
    const writer = await handle.createWritable();
    await writer.write("甲\nsecond\n");
    await writer.close();
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true, value: async () => [handle]
    });
  });
  await page.keyboard.press("Control+o");
  const editor = page.locator("#editor");
  await expect(editor).toHaveValue("甲\nsecond\n");
  await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
  await expect(editor).toHaveJSProperty("readOnly", false);
  await editor.fill("甲\nUPDATED\n");
  await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
  await page.keyboard.press("Control+s");
  await expect(page.locator("#statusLamp")).toHaveClass(/green/, {
    timeout: 30000
  });
  const saved = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle("pr8-uniform-small.txt");
    return (await handle.getFile()).text();
  });
  expect(saved).toBe("甲\nUPDATED\n");
});

test("PR8 small-to-medium 64KiB boundary uses stable global line seek",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(
        "pr8-uniform-medium.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.write("FIRST\n" + "a".repeat(65530) +
        "MIDDLE\n" + "tail");
      await writer.close();
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true, value: async () => [handle]
      });
    });
    await page.keyboard.press("Control+o");
    await expect(page.locator("#editor")).toHaveAttribute(
      "data-virtual-page-index", "0");
    await page.locator("#goLineInput").fill("3");
    await page.locator("#goLineButton").click();
    await expect(page.locator("#position")).toContainText("Ln 3");
    await expect(page.locator("#editor")).toHaveValue(/tail/);
  });

test("PR8 uniform slices preserve CRLF source bytes after editing",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(
        "pr8-uniform-crlf.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.write("甲\r\nsecond\r\n");
      await writer.close();
      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true, value: async () => [handle]
      });
    });
    await page.keyboard.press("Control+o");
    const editor = page.locator("#editor");
    await expect(editor).toHaveValue("甲\nsecond\n");
    await editor.fill("甲\nUPDATED\n");
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
    await page.keyboard.press("Control+s");
    await expect(page.locator("#statusLamp")).toHaveClass(/green/, {
      timeout: 30000
    });
    const result = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle("pr8-uniform-crlf.txt");
      return (await handle.getFile()).text();
    });
    expect(result).toBe("甲\r\nUPDATED\r\n");
  });
