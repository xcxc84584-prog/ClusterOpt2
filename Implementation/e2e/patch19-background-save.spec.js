import { test, expect } from "@playwright/test";

async function prepare(page, slowName) {
  await page.goto("/");
  await page.evaluate(async name => {
    const dir = await navigator.storage.getDirectory();
    const large = await dir.getFileHandle(name, { create: true });
    const writer = await large.createWritable();
    await writer.truncate(65 * 1024 * 1024);
    await writer.write("ORIGINAL");
    await writer.close();
    const other = await dir.getFileHandle(
      "save-progress-other.txt", { create: true });
    const otherWriter = await other.createWritable();
    await otherWriter.write("Another document");
    await otherWriter.close();
    const slowHandle = {
      kind: "file", name: large.name,
      getFile: () => large.getFile(),
      isSameEntry: async otherHandle => slowHandle === otherHandle,
      async createWritable(options) {
        const stream = await large.createWritable(options);
        return {
          async write(bytes) {
            await new Promise(resolve => setTimeout(resolve, 20));
            return stream.write(bytes);
          },
          close: () => stream.close(),
          abort: () => stream.abort()
        };
      }
    };
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true,
      value: async () => [slowHandle, other]
    });
  }, slowName);
  await page.keyboard.press("Control+o");
  const largeTab = page.locator(".tab").filter({ hasText: slowName });
  const otherTab = page.locator(".tab")
    .filter({ hasText: "save-progress-other.txt" });
  await largeTab.click();
  const editor = page.locator("#editor");
  await expect.poll(async () => (await editor.inputValue()).length)
    .toBe(65536);
  const original = await editor.inputValue();
  expect(original.startsWith("ORIGINAL")).toBe(true);
  await editor.fill("REPLACED!" + original.slice(8));
  await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
  return { editor, largeTab, otherTab };
}

test("Patch19 Fix3: save progress survives tab switching",
  async ({ page }) => {
    test.setTimeout(180000);
    const name = "progress-large-save.txt";
    const { largeTab, otherTab } = await prepare(page, name);
    await page.keyboard.press("Control+s");
    await expect(page.locator("#statusLamp")).toHaveClass(/blue/);
    try {
      await expect.poll(async () =>
        Number.parseInt(await page.locator("#meterPercent")
          .textContent(), 10), { timeout: 12000 })
        .toBeGreaterThan(0);
    } catch (error) {
      const info = await page.evaluate(() => ({
        lamp: document.getElementById("statusLamp")?.className,
        label: document.getElementById("status")?.textContent,
        percent: document.getElementById("meterPercent")?.textContent,
        ehu: window.Cluster?.log?.().filter(item =>
          item.kind === "EHU").slice(-8)
      }));
      throw new Error(JSON.stringify(info) + " " + error.message);
    }
    const first = Number.parseInt(
      await page.locator("#meterPercent").textContent(), 10);
    await otherTab.click();
    await expect(page.locator("#editor")).toHaveValue("Another document");
    await largeTab.click();
    const resumed = Number.parseInt(
      await page.locator("#meterPercent").textContent(), 10);
    expect(resumed).toBeGreaterThanOrEqual(first);
    await expect(page.locator("#statusLamp"))
      .toHaveClass(/green/, { timeout: 120000 });
    const disk = await page.evaluate(async name => {
      const root = await navigator.storage.getDirectory();
      const file = await (await root.getFileHandle(name)).getFile();
      return { size: file.size, prefix: await file.slice(0, 8).text() };
    }, name);
    expect(disk).toEqual({
      size: 65 * 1024 * 1024 + 1, prefix: "REPLACED"
    });
  });

test("Patch19 Fix3: edit aborts uncommitted save and retains edits",
  async ({ page }) => {
    test.setTimeout(180000);
    const name = "progress-aborted-save.txt";
    const { editor } = await prepare(page, name);
    await page.keyboard.press("Control+s");
    await expect(page.locator("#statusLamp")).toHaveClass(/blue/);
    try {
      await expect.poll(async () =>
        Number.parseInt(await page.locator("#meterPercent")
          .textContent(), 10), { timeout: 12000 })
        .toBeGreaterThan(0);
    } catch (error) {
      const info = await page.evaluate(() => ({
        lamp: document.getElementById("statusLamp")?.className,
        label: document.getElementById("status")?.textContent,
        percent: document.getElementById("meterPercent")?.textContent,
        ehu: window.Cluster?.log?.().filter(item =>
          item.kind === "EHU").slice(-8)
      }));
      throw new Error(JSON.stringify(info) + " " + error.message);
    }
    const value = await editor.inputValue();
    await editor.fill("NEWER!!!" + value.slice(8));
    await expect(page.locator("#statusLamp"))
      .toHaveClass(/yellow/, { timeout: 90000 });
    await expect(editor).toHaveValue(/^NEWER!!!/);
    const disk = await page.evaluate(async name => {
      const root = await navigator.storage.getDirectory();
      const file = await (await root.getFileHandle(name)).getFile();
      return { prefix: await file.slice(0, 8).text(), size: file.size };
    }, name);
    expect(disk).toEqual({
      prefix: "ORIGINAL", size: 65 * 1024 * 1024
    });
  });
