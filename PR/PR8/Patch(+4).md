# PR8 Patch(+4) — Virtual slice registry foundation

- New SliceBudgetPolicy and SliceRegistry in separate files.
- Virtual descriptor: address only, zero resident text.
- Loader may promote to preloaded/full; read permitted only when full.
- Evict preloaded first, then clean offscreen full, never dirty or visible.
- Atomic admission planning prevents partial eviction on quota failure.
- Supports numeric limit or Off (null), but no editor UI wiring yet.
- P-tree, B+ index, plugin/highlighter, MVCC/writeback still pending.
Status: PARTIAL; CI required.
