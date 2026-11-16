import { test, expect } from "@playwright/test";

test("PR8 Patch17 OPFS writeback verifies bytes and retires checkpoint",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const { SliceRecoveryJournal } = await import(
        "/Implementation/object/SliceRecoveryJournal.js");
      const { SliceEditTransaction } = await import(
        "/Implementation/object/SliceEditTransaction.js");
      const { SliceWritebackUnit } = await import(
        "/Implementation/object/SliceWritebackUnit.js");
      const { SliceFileWritePolicy } = await import(
        "/Implementation/property/SliceFileWritePolicy.js");
      const core = new LinkCore();
      core.register({ id: "ui", receive: async () => true });
      new SliceRecoveryJournal(core);
      new SliceWritebackUnit(core);
      new SliceEditTransaction(core);
      const folder = await navigator.storage.getDirectory();
      const id = "p17-" + Date.now();
      const handle = await folder.getFileHandle(id + ".txt", {
        create: true
      });
      const source = "head\n中間\ntail";
      const writer = await handle.createWritable();
      await writer.write(new TextEncoder().encode(source));
      await writer.close();
      const file = await handle.getFile();
      const originalBytes = new TextEncoder().encode(source);
      const start = "head\n".length;
      const end = start + new TextEncoder().encode("中間").length;
      const sliceHash = await SliceFileWritePolicy.digest(
        originalBytes.slice(start, end));
      const call = (action, payload) => core.request(
        "ui", "slice-edit-transaction", action, payload,
        { origin: "user" });
      const opened = await call("open", { id, text: "中間" });
      if (!opened.ok) return opened;
      const edited = await call("transactDurable", {
        id, revision: 0, operations: [{
          type: "replace", start: 0, end: 2,
          text: "中文字!"
        }]
      });
      if (!edited.ok) return edited;
      const saved = await call("commitWriteback", {
        id, revision: 1, handle, start, end,
        expectedSize: file.size,
        expectedLastModified: file.lastModified,
        expectedSliceHash: sliceHash
      });
      if (!saved.ok) return saved;
      const writtenFile = await handle.getFile();
      const written = await writtenFile.text();
      const journal = await core.request("ui",
        "slice-recovery-journal", "restore", { id },
        { origin: "user" });
      return { ok: saved.ok, text: written,
        dirty: saved.value.dirty,
        retired: journal.status === 404,
        verified: saved.value.receipt.verified };
    });
    expect(result).toEqual({
      ok: true, text: "head\n中文字!\ntail",
      dirty: false, retired: true, verified: true
    });
  });
