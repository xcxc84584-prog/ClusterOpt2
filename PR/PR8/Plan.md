# PR8 Plan (initial draft)
- Requirements: virtual-first slices; P-tree primary plus B+ tree auxiliary.
- Algorithms: logarithmic piece insert, chunk-index seek, bounded LRU.
- Performance: no full-buffer read on large files; tune viewport and preload.
- Security: CSS-only plugin validation and sandboxing, IndexedDB quota
  handling, atomic writeback and MVCC snapshots.
- Data: max fully-loaded plus preloaded bytes settable, or Off.
- Load colors: blue per-operation percentage, not global document share.
- Tests: rapid scroll, goto-line, zoom, cross-file switch, dirty eviction,
  reload recovery, progressive memory pressure and malicious CSS rejection.

## Patch(+1): viewport guides and status-meter foundation
- Baseline: PR1-5 PASS by user; PR6-7 acceptance requested via VTE.
- Fix guide renderer using real newline separators and measured padding,
  line-height, and scrollLeft; no fixed pixel assumptions.
- Progress bar state: green synced, yellow dirty, red error, blue loading.
  Blue percentage represents the current operation only.
- Shared EditorViewportPolicy (one pure property) controls calculations.
- VTE tests exercise 200/4xx, EHU and log; VTE is sandbox-only
  and cannot certify browser filesystem permissions or actual loading.
- Load estimate: viewport guide O(visible lines); no whole-file
  processing introduced. No disk/network access from the geometry policy.
- PR8 full six-layer slice editor and Plugin manager remain outstanding.
