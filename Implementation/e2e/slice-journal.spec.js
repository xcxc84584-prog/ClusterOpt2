import { test, expect } from "@playwright/test";

/**
 * Uses real same-origin IndexedDB, not the in-memory unit-test adapter.
 * The main text editor is unaffected; these Objects remain sandboxed.
 */
async function sandbox(page) {
  await page.goto("/");
  return page.evaluate(async () => {
    const { LinkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const { SliceRecoveryJournal } = await import(
      "/Implementation/object/SliceRecoveryJournal.js");
    const { SliceEditTransaction } = await import(
      "/Implementation/object/SliceEditTransaction.js");
    const core = new LinkCore();
    core.register({ id: "ui", receive: async () => true });
    new SliceRecoveryJournal(core);
    new SliceEditTransaction(core);
    // New page contexts cannot reuse JS Object references. The test
    // exercises each EventChain in a single page evaluation instead.
    return core.getSnapshot().objects.includes("slice-recovery-journal");
  });
}

test("PR8 Patch16 recovers SHA-256 checkpoint across page reload",
  async ({ page }) => {
    expect(await sandbox(page)).toBe(true);
    const id = "browser-" + Date.now();
    const wrote = await page.evaluate(async key => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const { SliceRecoveryJournal } = await import(
        "/Implementation/object/SliceRecoveryJournal.js");
      const { SliceEditTransaction } = await import(
        "/Implementation/object/SliceEditTransaction.js");
      const core = new LinkCore();
      core.register({ id: "ui", receive: async () => true });
      new SliceRecoveryJournal(core);
      new SliceEditTransaction(core);
      const open = await core.request("ui", "slice-edit-transaction",
        "open", { id: key, text: "一二三" }, { origin: "user" });
      if (!open.ok) return open;
      return core.request("ui", "slice-edit-transaction",
        "transactDurable", {
          id: key, revision: 0,
          operations: [{ type: "insert", start: 3, text: "四" }]
        }, { origin: "user" });
    }, id);
    expect(wrote.ok).toBe(true);
    expect(wrote.value.revision).toBe(1);

    await page.reload();
    const recovered = await page.evaluate(async key => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const { SliceRecoveryJournal } = await import(
        "/Implementation/object/SliceRecoveryJournal.js");
      const { SliceEditTransaction } = await import(
        "/Implementation/object/SliceEditTransaction.js");
      const core = new LinkCore();
      core.register({ id: "ui", receive: async () => true });
      new SliceRecoveryJournal(core);
      new SliceEditTransaction(core);
      const restored = await core.request("ui",
        "slice-edit-transaction", "restoreDurable",
        { id: key }, { origin: "user" });
      if (!restored.ok) return restored;
      const read = await core.request("ui",
        "slice-edit-transaction", "read",
        { id: key, start: 0, end: 4 }, { origin: "user" });
      return { ok: read.ok, text: read.value,
        revision: restored.value.revision,
        dirty: restored.value.dirty };
    }, id);
    expect(recovered).toEqual({
      ok: true, text: "一二三四", revision: 1, dirty: true
    });
  });

test("PR8 Patch16 same-origin tabs reject conflicting revisions",
  async ({ page, context }) => {
    const second = await context.newPage();
    try {
      expect(await sandbox(page)).toBe(true);
      expect(await sandbox(second)).toBe(true);
      const id = "race-" + Date.now();
      const attempt = current => current.evaluate(async key => {
        const { LinkCore } = await import(
          "/Implementation/LinkCore/LinkCore.js");
        const { SliceRecoveryJournal } = await import(
          "/Implementation/object/SliceRecoveryJournal.js");
        const { SliceEditTransaction } = await import(
          "/Implementation/object/SliceEditTransaction.js");
        const core = new LinkCore();
        core.register({ id: "ui", receive: async () => true });
        new SliceRecoveryJournal(core);
        new SliceEditTransaction(core);
        await core.request("ui", "slice-edit-transaction",
          "open", { id: key, text: "A" }, { origin: "user" });
        const result = await core.request("ui",
          "slice-edit-transaction", "transactDurable", {
            id: key, revision: 0,
            operations: [{ type: "insert", start: 1, text: "B" }]
          }, { origin: "user" });
        return result.status;
      }, id);
      const statuses = await Promise.all([attempt(page), attempt(second)]);
      expect(statuses.sort()).toEqual([200, 409]);
    } finally {
      await second.close();
    }
  });
