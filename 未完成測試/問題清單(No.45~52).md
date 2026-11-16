# PR8 outstanding tests and risks — No.45 to No.52

| No. | Status | Scope / acceptance gate |
| --- | --- | --- |
| 45 | CI pending | Plugin File-style category dropdown: locale, keyboard, outside click, high zoom and workbench TAB lifecycle |
| 46 | Pending | Map real pixel/line viewport and zoom to byte slice range, accounting for multibyte UTF-8 and line wrapping |
| 47 | Pending | Cancel/supersede stale rapid scroll/jump loads with generation fencing and per-document queue; avoid long main-thread stalls |
| 48 | Pending | Replace whole-file textarea buffer with fully virtualized visible slice editor; integrate PieceTree + B+ seeking |
| 49 | Pending | Stage-3/5 pluggable processors and committers, independently controlled defaults and sandboxed user plugins |
| 50 | Pending | Chunk-level MVCC revision, save/atomic writeback and clean demotion after durable commit |
| 51 | Pending | Crash/reload recovery of dirty slices, revision tree, pending saves and exact viewport/cursor |
| 52 | Pending | Gigabyte-scale scroll/edit stress, memory-limit accounting, invalid UTF-8, permissions, quotas and cross-file concurrency |

Patch(+11) implements a bounded **logical slice-index** viewport
coordinator for VTE; it does NOT yet convert browser scroll pixels
to indexes or enable slice-based editing in the production textarea.
Protection for dirty slices must remain invariant under all patches.
