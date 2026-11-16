# PR7 Patch(+4) — Durable Explorer drag ordering
- Shared ExplorerOrderPolicy defines sibling reordering and stable sorting.
- Root and nested directory ordering saved in IndexedDB recovery snapshots.
- Detached open-document entries reorder through FileWorkspace.
- Added browser drag test and Node snapshot/restore tests.
- No disk move/rename is performed.
Status: Pending CI and browser regression; PR7 NOT PASS.
