import { test, expect } from "@playwright/test";

async function prepareLargeFile(page, name, permission = "granted") {
  await page.goto("/");
  await page.evaluate(async ({ name, permission }) => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(name, { create: true });
    const writer = await handle.createWritable();
    await writer.truncate(65 * 1024 * 1024);
    await writer.write("ORIGINAL");
    await writer.close();
    const selected = {
      name: handle.name,
      kind: "file",
      getFile: (...args) => handle.getFile(...args),
      createWritable: (...args) => handle.createWritable(...args),
      isSameEntry: async other => other === selected,
      requestPermission: async () => permission
    };
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true, value: async () => [selected]
    });
  }, { name, permission });
  await page.keyboard.press("Control+o");
  const editor = page.locator("#editor");
  await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
  await expect.poll(async () => (await editor.inputValue()).length)
    .toBe(65536);
  const before = await editor.inputValue();
  await editor.fill("REPLACED" + before.slice("ORIGINAL".length));
  await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
  return editor;
}

test("Patch19 fix2: Close All saves large dirty file and removes tab",
  async ({ page }) => {
    test.setTimeout(120000);
    await prepareLargeFile(page, "fix2-close-all.txt");
    await page.evaluate(() => { window.confirm = () => true; });
    await page.locator("#closeAllMain").evaluate(button => button.click());
    await expect(page.locator(".tab.active"))
      .toHaveCount(0, { timeout: 90000 });
    const file = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle("fix2-close-all.txt");
      const value = await handle.getFile();
      return { length: value.size, text: await value.slice(0, 8).text() };
    });
    expect(file).toEqual({
      length: 65 * 1024 * 1024, text: "REPLACED"
    });
  });

test("Patch19 fix2: denied local write permission preserves dirty tab",
  async ({ page }) => {
    await prepareLargeFile(page, "fix2-denied.txt", "denied");
    await page.keyboard.press("Control+s");
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
    await expect(page.locator(".tab.active")).toHaveCount(1);
    const text = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      return (await (await root.getFileHandle("fix2-denied.txt"))
        .getFile()).slice(0, 8).text();
    });
    expect(text).toBe("ORIGINAL");
  });

test("Patch19 fix2: Close All cancel retains dirty large file",
  async ({ page }) => {
    await prepareLargeFile(page, "fix2-cancel.txt");
    await page.evaluate(() => { window.confirm = () => false; });
    await page.locator("#closeAllMain").evaluate(button => button.click());
    await expect(page.locator(".tab.active")).toHaveCount(1);
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
  });
