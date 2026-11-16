import { test, expect } from "@playwright/test";

test("Patch19 large OPFS editor can edit and shows global page lines",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(
        "pr8-patch19-large.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.truncate(65 * 1024 * 1024);
      const initial = "FIRST\n" + "x".repeat(65536 - 6);
      await writer.write({ type: "write", position: 0, data: initial });
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
    await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
    await expect(editor).toHaveJSProperty("readOnly", false);
    await expect(page.locator("#gutter")).toContainText("1");

    await editor.focus();
    await editor.press("Alt+PageDown");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "1");
    await expect(page.locator("#gutter")).toContainText("2");
    await expect(page.locator("#position")).toContainText("Ln 2");

    const before = await editor.inputValue();
    await editor.fill("CHANGED\n" + before.slice(7));
    await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
    await editor.press("Alt+PageUp");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "0");
    await editor.press("Alt+PageDown");
    await expect(editor).toHaveAttribute("data-virtual-page-index", "1");
    await expect(editor).toHaveValue(/^CHANGED/);

    const file = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle("pr8-patch19-large.txt");
      const blob = await handle.getFile();
      return {
        size: blob.size,
        original: await blob.slice(65536, 65543).text()
      };
    });
    expect(file).toEqual({
      size: 65 * 1024 * 1024, original: "SECOND\n"
    });
  });

test("Patch19 OPFS durable page edit/writeback retires checkpoint",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const { VirtualFileDocument } = await import(
        "/Implementation/object/VirtualFileDocument.js");
      const { SliceEditTransaction } = await import(
        "/Implementation/object/SliceEditTransaction.js");
      const { SliceRecoveryJournal } = await import(
        "/Implementation/object/SliceRecoveryJournal.js");
      const { SliceWritebackUnit } = await import(
        "/Implementation/object/SliceWritebackUnit.js");
      const { SliceBatchWritebackUnit } = await import(
        "/Implementation/object/SliceBatchWritebackUnit.js");
      const core = new LinkCore();
      core.register({ id: "ui", receive: async () => true });
      core.register({ id: "workspace", receive: async () => true });
      new SliceRecoveryJournal(core);
      new SliceEditTransaction(core);
      new SliceWritebackUnit(core);
      new SliceBatchWritebackUnit(core);
      const folder = await navigator.storage.getDirectory();
      const handle = await folder.getFileHandle(
        "pr8-patch19-commit.txt", { create: true });
      const writer = await handle.createWritable();
      await writer.write("old 中\n");
      await writer.close();
      const doc = new VirtualFileDocument(handle.name, handle, core);
      core.register(doc);
      const load = await core.request("workspace", doc.id, "load");
      if (!load.ok) return { fail: load };
      const edit = await core.request("ui", doc.id, "edit", {
        text: "new 😀\n"
      }, { origin: "user" });
      if (!edit.ok) return { fail: edit };
      const savedEditId = doc.editSliceId;
      const save = await core.request("ui", doc.id, "save", {},
        { origin: "user" });
      if (!save.ok) return { fail: save };
      const text = await (await handle.getFile()).text();
      const old = await core.request("ui",
        "slice-recovery-journal", "restore", {
          id: savedEditId
        }, { origin: "user" });
      return {
        text, status: doc.status, retired: old.status === 404
      };
    });
    expect(result).toEqual({
      text: "new 😀\n", status: "green", retired: true
    });
  });
