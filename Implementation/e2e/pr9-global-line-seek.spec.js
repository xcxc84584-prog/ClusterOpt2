import { test, expect } from "@playwright/test";

test("PR9 global line jump loads distant virtual page in old UI", async ({
  page
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(
      "pr9-global-lines.txt", { create: true });
    const writer = await handle.createWritable();
    await writer.truncate(65 * 1024 * 1024);
    await writer.write({
      type: "write", position: 0, data: "HEADER\n"
    });
    await writer.write({
      type: "write", position: 131065, data: "MIDDLE\n"
    });
    await writer.write({
      type: "write", position: 131072, data: "TAIL"
    });
    await writer.close();
    Object.defineProperty(window, "showOpenFilePicker", {
      configurable: true, value: async () => [handle]
    });
  });
  await page.keyboard.press("Control+o");
  const editor = page.locator("#editor");
  await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
  await page.locator("#goLineInput").fill("3");
  await page.locator("#goLineButton").click();
  await expect(editor).toHaveAttribute("data-virtual-page-index", "2");
  await expect(editor).toHaveValue(/TAIL/);
  await expect(page.locator("#position")).toContainText("Ln 3");
  await page.locator("#goLineInput").fill("1");
  await page.locator("#goLineButton").click();
  await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
  await expect(editor).toHaveValue(/HEADER/);
  await page.locator("#goLineInput").fill("4");
  await page.locator("#goLineButton").click();
  await expect(page.locator("#goLineHint")).toHaveText(/.+/);
  await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
  const bar = await page.locator("#goLineBar").boundingBox();
  const workspace = await page.locator("#clusterWorkspaceShell").boundingBox();
  const footer = await page.locator(".statusbar").boundingBox();
  expect(bar.y).toBeGreaterThanOrEqual(workspace.y + workspace.height - 1);
  expect(bar.y + bar.height).toBeLessThanOrEqual(footer.y + 1);
});
