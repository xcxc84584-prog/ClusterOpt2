# PR6 Patch(+8) — Browser reload regression
- Added Playwright IndexedDB recovery test for unsaved text,
  single restored tab, editor scrollTop, and Explorer visible state.
- No new UI styling. The test waits for the persisted snapshot.
- Regression does not assert browser-level file permission grants.
Status: browser CI pending, PR6 PARTIAL.
