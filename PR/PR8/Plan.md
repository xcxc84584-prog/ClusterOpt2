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

## Patch(+5): File Tool Plugin > Performance
Replace legacy disabled highlighter menu item with Plugin submenu.
Performance controls SliceRegistry cache budget with MiB input/Off;
setting persists in localStorage and passes via HubUnit Request.
Custom highlighter remains disabled until safe CSS plugin pipeline
and actual editor slice loader are built. The UI explicitly states
this limit currently applies only to the independent registry.

## Patch(+6): independent piece tree foundation
- PieceTreeIndex Object exposes insert/remove/read/locate/info through Hub.
- PieceTreePolicy provides an immutable treap with expected logarithmic
  split/merge/position edits. BPlusSliceIndex is a lazy rebuilt leaf index.
- UTF-16 offsets follow current browser editor conventions; loader must
  map disk bytes. No disk/network I/O, privileged plugin execution or keys.
- Rebuild O(P) after mutations on next seek; seek O(log P).
- Same-object edits are serial requests; optional expected revision
  detects stale edits (409). End-to-end file loading remains unfinished.
- CI acceptance: Node unit tests, lint, and Playwright regressions.

## Patch(+7): bounded virtual Blob slice foundation
- SliceLoader open stores Blob + chunk metadata without reading text.
- Loading only a requested chunk uses Blob.slice with UTF-8 aligned
  byte boundaries; TextDecoder fatal rejects malformed input.
- Every SliceRegistry registration/load travels through HubUnit.
- Default 64 KiB; configurable 1 KiB to 1 MiB chunk size.
- Read memory O(chunk size), excluding host Blob backing storage.
- Tests: Unicode boundaries, lazy reads, mode rules and EHU errors.
- Remains isolated from main editor; no viewport, cancellation or
  editor memory-budget guarantee until later integration.
- Plugin modal design, default enable toggles, developer plugin
  import and downloadable API standards added to future acceptance.
- Plugin interfaces must define input/output types, permissions,
  versioning, time/memory limits, failure policy and safe fallback.

## Patch(+8): UI and extension API contract baseline
- Native dialog for File > Tool > Plugin, responsive with palette tokens.
- Existing SliceRegistry limit setting and Off mode retained.
- Three downloadable versioned API specs: processor, committer,
  highlighter; execution/import remain unavailable until sandbox review.
- Restore legacy blocked-file-type replace action through HubUnit,
  with 400/404/409 failures and Explorer refresh.
- Plugin categories will support disabling defaults in later stages;
  disabling critical MVCC does not disable core conflict protection.
- UI E2E: modal opening, escape/done, language, narrow layout,
  preference persistence and disabled unfinished actions.

## Patch(+9): visual parity and navigable Plugin configuration
- Compared actual legacy blocked-file-type UI implementation.
- Restored pencil/cross compact controls, prompt rename, localized 400/409
  feedback without bypassing HubUnit or changing stored file bytes.
- Plugin dialog separates performance, highlighter, processor and
  committer panels, using VS Code-style categories and details.
- Unimplemented runtimes remain inactive; API specs are downloadable.
- Test modal navigation, narrow viewport, locale and blocked list actions.
- No change to slice-loader/editor memory architecture in this patch.

## Patch(+10): File Tool Plugin as workspace TAB
- Replace Plugin modal with read-only (non-document) tool window.
- The existing file-tab strip renders tool and document tabs together.
- ToolTabManager owns open/activate/deactivate/close/move/list lifecycle;
  ToolTabPolicy owns tool identity, ordering and insertion bounds.
- Plugin classification buttons are in the **tool-window header top-right**,
  not in the application toolbar. Responsive behavior is contained.
- FileWorkspace remains sole owner of file bytes; closing/saving Plugin
  must not modify the file or corrupt restoration.
- VTE tests cover 200/400/404 EventChain, EHU and relation codes.
- Browser tests cover unsaved-text protection, switching/reopening,
  actual window-relative category placement, settings and localization.
- Per-tab memory and runtime cost are bounded; no full-file processing
  is introduced by this UI patch.
- Full PR8 six-layer sliced editor and Plugin runtime remain pending.
