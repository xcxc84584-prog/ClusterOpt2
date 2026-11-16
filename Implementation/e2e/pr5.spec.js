import { test, expect } from "@playwright/test";

test("PR5 pairs brackets and deletes pairs inside existing editor", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const editor = page.locator("#editor");
  await editor.focus();
  await editor.press("(");
  await expect(editor).toHaveValue("()");
  await editor.press("Backspace");
  await expect(editor).toHaveValue("");
  await editor.press("{");
  await editor.press("Enter");
  await expect(editor).toHaveValue("{\n\t\n}");
});

test("PR5 tab deletion and viewport guides", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const editor = page.locator("#editor");
  await editor.focus();
  await editor.press("Tab");
  await expect(editor).toHaveValue("\t");
  await editor.press("Backspace");
  await expect(editor).toHaveValue("");
  await editor.press("Tab");
  await expect(page.locator("#tabGuide")).toContainText("┊");
});

test("PR4 keeps only File menu Close All", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await expect(page.locator("#closeAllMain")).toBeVisible();
  await page.locator("#toolBtn").click();
  await expect(page.locator("#closeAll")).toHaveCount(0);
});

test("PR5 synthetic pairing should support undo and redo", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const editor = page.locator("#editor");
  await editor.focus();
  await editor.press("(");
  await expect(editor).toHaveValue("()");
  await editor.press("Control+z");
  await expect(editor).toHaveValue("");
  await editor.press("Control+Shift+z");
  await expect(editor).toHaveValue("()");
});
