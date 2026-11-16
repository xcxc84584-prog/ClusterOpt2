import { test, expect } from "@playwright/test";

async function prepare(page, name) {
  await page.goto("/");
  await page.evaluate(async fileName => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.truncate(65 * 1024 * 1024);
    await writable.write({
      type: "write", position: 0,
      data: "ORIGINAL\n"
    });
    await writable.write({
      type: "write", position: 65536,
      data: "OLD NEXT PAGE"
    });
    await writable.close();
    window.__testVirtualHandle = handle;
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true, value: async () => [handle]
    });
  }, name);
  await page.keyboard.press("Control+o");
  const editor = page.locator("#editor");
  await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
  return editor;
}

test("PR8 Fix5: clean OPFS file rebases across changed generation",
  async ({ page }) => {
    const editor = await prepare(page, "fix5-clean-generation.txt");
    await page.evaluate(async () => {
      const handle = window.__testVirtualHandle;
      const writer = await handle.createWritable({
        keepExistingData: true
      });
      await writer.write({
        type: "write", position: 65536,
        data: "NEW NEXT PAGE"
      });
      await writer.close();
    });
    await editor.press("Alt+PageDown");
    await expect(editor).toHaveAttribute(
      "data-virtual-page-index", "1");
    await expect(editor).toHaveValue(/^NEW NEXT PAGE/);
    await expect(page.locator("#statusLamp")).toHaveClass(/green/);
    const conflicts = await page.evaluate(() =>
      window.Cluster.log().filter(item => item.kind === "EHU" &&
        item.status === 409 &&
        item.action === "Response.page").length);
    expect(conflicts).toBe(0);
  });

test("PR8 Fix5: dirty OPFS page retains edits on external conflict",
  async ({ page }) => {
    const editor = await prepare(page, "fix5-dirty-conflict.txt");
    const original = await editor.inputValue();
    await editor.fill("EDITED!!" + original.slice(8));
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
    await page.evaluate(async () => {
      const handle = window.__testVirtualHandle;
      const writer = await handle.createWritable({
        keepExistingData: true
      });
      await writer.write({
        type: "write", position: 65536,
        data: "CONFLICT PAGE"
      });
      await writer.close();
    });
    await editor.press("Alt+PageDown");
    await expect(editor).toHaveAttribute(
      "data-virtual-page-index", "0");
    await expect(editor).toHaveValue(/^EDITED!!/);
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
    const conflicts = await page.evaluate(() =>
      window.Cluster.log().filter(item => item.kind === "EHU" &&
        item.status === 409 &&
        item.action === "Response.page").length);
    expect(conflicts).toBeGreaterThan(0);
  });
