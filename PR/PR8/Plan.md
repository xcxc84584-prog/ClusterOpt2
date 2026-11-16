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

### Patch(+10) recovery extension
- Restore tool-tab state/category after document recovery, clamping
  positions if documents become unavailable; closing the tab persists.
- Never put tool tabs into FileWorkspace or editable document snapshots.

## Patch(+11): compact Plugin menu + virtual viewport coordinator
- Replace always-visible category buttons with a File-style dropdown,
  right-aligned inside Plugin tool window, collapsed by default.
- Keyboard interaction per WAI-ARIA Menu Button, locale and RGB support.
- Add ViewportSlicePolicy pure bounded logical slice index planner,
  and ViewportSliceController OCDA Object orchestrating Loader/Registry.
- Virtual open reads no text; full-load requested visible byte slices;
  speculative adjacent preloads; demote clean offscreen entries.
- Resource guard: max 16 visible, max 2 neighbor slices per side,
  existing max <=1 MiB/slice and configurable registry memory limit.
- Dirty slices never overwritten/evicted. Budget 413 skips preloads;
  requested full-load failures always propagate as EHU.
- No pixel/line->byte mapping or virtual editor integration yet.
- VTE should confirm 200/400/404/409/413 EventChain and Req/Rep.
- CI covers accessible dropdown and legacy workbench TAB behavior.

## Patch(+12): exact line / byte address mapping
- Introduce VirtualLineIndex as a separate OCDA Object storing
  virtual Blob references and sparse checkpoints, not document text.
- LineAddressPolicy scans at most 64 KiB per Blob.slice operation,
  yields every eight windows, stores one checkpoint per 4096 lines.
- Add accurate bytePlan mapping in ViewportSlicePolicy and expose
  navigateBytes/navigateLines in ViewportSliceController.
- BOM/UTF-8 continuation bytes do not alter LF byte counting;
  CRLF counts as one line ending. Bare CR is not yet supported.
- Performance: cold far-ahead seek O(bytes traversed) and bounded
  transient memory, indexed backward seek from sparse checkpoint.
- Memory: O(checkpoints + resident slices); no whole-file decoder.
- Risks: unindexed high-line jump requires scanning; UI line mapping,
  PieceTree/B+ and writeback not integrated yet.
- Tests: UTF-8/Chinese/emoji/CRLF, sparse checkpoint jump/backseek,
  byte boundaries, EOF, empty blob, VTE EHU and Relation 10/01;
  preserve existing editor + Plugin TAB browser tests.

### Patch(+12): cleanup lifecycle and risk containment
- On closing a virtual document, preflight the owned
  SliceRegistry entries for dirty content.
- If dirty, return 409 before freeing Blob or index resources.
- For clean slices, release registry descriptors, loader-owned Blob
  and sparse line-index checkpoints via HubUnit EventChain.
- Allow virtual ID reuse only after complete close.
- Tests: EHU 409 on dirty close, no loss of resident dirty data,
  successful cleanup and subsequent open with same ID.

## Patch(+13): pixel-to-line viewport bridge
- Shared pure ViewportLinePolicy derives visible 1-based lines from
  scrollTop, clientHeight and computed lineHeight (zoom-aware pixels).
- ViewportSliceController.navigateViewport maps geometry through the
  existing VirtualLineIndex.range and exact bytePlan path via HubUnit.
- Guard non-finite/invalid geometry and >8192 visible lines with EHU 400.
- No proportional byte guesses, full-document scans or unsafe edits.
- Main textarea still owns full text; wiring actual slice rendering,
  MVCC and recovery remains pending. Never claim PR8 acceptance here.
- Tests: geometry at zoom-equivalent heights, invalid inputs, Hub
  EventChain with Blob and close. CI and browser QA required before merge.
- Performance: O(1) geometry, then existing indexed range lookup and
  bounded resident slice cache; worst unindexed line seeks scan forward
  in 64 KiB windows without decoding the entire document into memory.
- Security: no user plugin execution, no key/absolute path, and
  privileged slice cleanup remains gated by trusted controller.

## Patch(+14): passive editor viewport integration
- Added EditorViewportObserver Object as an OCDA read-only bridge to the
  existing ViewportSliceController. It never replaces textarea text.
- Real editor scroll/zoom geometry is read from DOM via computed lineHeight,
  scrollTop, clientHeight, and lineCount from existing line render.
- Main UI schedules/debounces observations (80ms) and serializes attach,
  detach and navigate to prevent stale asynchronous file read races.
- Only clean, handle-backed, active documents may be observed.
  Dirty, external-conflict, tool and closed tabs detach immediately.
- Virtual slices remain independent Blob-backed caches and may be demoted.
  Existing FileDocument owns all real editing, save and reload recovery.
- The safe bridge is an incremental integration, NOT a complete
  slice-editable editor. Continue Piecetree/MVCC/writeback work in Patch15.
- Tests cover geometry clamp, clean attach/navigate/detach, dirty and
  stale document rejection; browser E2E and GitHub CI are not yet verified.
- Load: O(1) pixels-to-lines per event plus indexed line seeks; 80ms
  coalescing avoids issuing a request for each scroll event. The current
  legacy textarea remains full-buffer and the existing line-number
  renderer remains O(total lines); no large-file acceptance claim.
- Security: no external plugin execution, no keys, no absolute paths,
  no disk mutation in viewport observer; existing EHU/Log rules apply.

## Patch(+15): sandboxed atomic slice edit transactions
- Add independent SliceEditTransaction OCDA Object with per-slice
  immutable Piece Tree roots and revision-based optimistic concurrency.
- Add shared SliceTransactionPolicy for bounded operation validation,
  UTF-16 offsets, max 128 operations and max 1 Mi UTF-16 code units.
- Operations: insert, remove, replace. Each batch publishes only after
  all edits are validated; mid-batch failures leave root/revision intact.
- Immutable PieceTreePolicy and lazy BPlusSliceIndex are reused directly
  through registered EDPMU Properties. No duplicate algorithms.
- Dirty slices refuse close (409). This prototype is volatile memory,
  **not durable MVCC** and is deliberately disconnected from FileDocument.
- Error matrix: 400 bad range/input, 404 absent slice, 409 revision/
  dirty close, 413 oversized candidate. HubUnit records EHU/Dependency.
- Performance: expected tree edit O(log pieces) each, B+ lazy build
  O(pieces), read O(pieces) worst-case; transaction holds only bounded
  temporary immutable nodes; memory cost proportional to edited pieces.
- Security: no filesystem write, no external code/key/absolute paths,
  no user-facing unfinished controls. Dirty revisions cannot be erased
  via close. Tests required before any integration or merge.
- Later: durable journal, crash-safe commit, per-slice scheduler keys,
  recovery, and actual EditorViewport text rendering.
