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

## Patch(+2): PR6/PR7 VTE acceptance
Use the actual Explorer, FileWorkspace and FileTypeManager objects on
a detached VTE LinkCore with synthetic FileSystemHandles. Exercise
import, list, reorder, file-type blocking and close-root Request/Response.
Check EHU 400 and two directed relation codes. Test only logic:
real browser grants, OS updates and UI visual parity still require QA.

## Patch(+3): exact legacy DFOM visual semantics
- Original ClusterOpt Program/src/dfom.js mirrors whitespace via
  literal Tab spans with dashed pseudo-elements, no replacement glyph.
- Render a viewport-bounded mirror and translate inner content on
  horizontal scroll; negative CSS padding is invalid.
- Retain original text bytes. Memory scales with visible rows.

## Patch(+4): isolated virtual slice registry
- SliceRegistry Object owns virtual descriptors and resident text slices.
- SliceBudgetPolicy Property performs pure memory-budget admission
  with preloaded-first eviction, then offscreen clean fully loaded slices.
- Dirty and visible chunks are never discarded by memory pressure.
- Limit null=Off; numeric limits 1 KiB to 1 GiB.
- Registered slices hold start/end addresses only until loaded.
- O(N log N) eviction planning at each admission; memory O(resident text).
- Future integration: P-tree primary, B+ index, filesystem range reads,
  per-slice parallel Object scheduling and Plugin processor stages.
