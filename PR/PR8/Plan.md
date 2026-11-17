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

## Patch(+16): durable slice checkpoint journal / recovery foundation
- New Object SliceRecoveryJournal persists per-slice revision/text/hash to
  separate IndexedDB database clusteropt2-slice-journal. No direct disk write.
- IndexedDBSliceJournalStore is an isolated storage adapter. Each write
  acknowledges only after the readwrite transaction completes; no
  sessionStorage silent fallback for failed durable writes.
- New shared EDPMU Property SliceJournalPolicy validates schema (v1),
  slice ID, bounded text, monotonic revisions and SHA-256 integrity.
- SliceEditTransaction.transactDurable computes immutable candidate,
  persists candidate revision through HubUnit, then publishes in-memory
  root only if the checkpoint is acknowledged.
- SliceEditTransaction.restoreDurable recovers verified text and original
  revision in a fresh object runtime; recovered slices remain dirty and
  refuse unsafe close.
- Existing volatile transact/edit path and FileDocument are unchanged.
  New Objects are registered for Hub/VTE; no end-user toggle/exposure.
- Security: UserAPI denies direct journal persist/discard; it only
  permits verified read recovery. SHA-256 detects corruption but is
  not authentication. Browser storage is same-origin.
- EHU: 200 verified success; 400 malformed payload, 403 unexposed
  UserAPI, 404 missing checkpoint, 409 non-increasing revision/dirty
  close, 422 corrupt checkpoint, 503 storage/crypto unavailable.
- Load: at most 1 Mi UTF-16 units per checkpoint; sealing uses
  O(slice bytes) time and memory. No whole-document allocation by
  this journal. Write amplification is a full bounded slice snapshot.
- Cross-tab CAS is now enforced inside one IndexedDB readwrite
  transaction (get revision and put checkpoint are atomic). A second
  preflight SHA-256 validation handles already-corrupt data.
- Remaining: actual file writeback, real-browser IndexedDB crash
  fault injection and durable recovery of cursor/viewport.
  Treat this as a **foundation**, not proven crash-safe full MVCC.
- Tests: simulated persistent storage across runtime recreation,
  disk-like quota failure rollback, checksum tampering, 403/404/409,
  EHU and Relation/Dependency, plus real Playwright IndexedDB reload
  and same-origin two-tab CAS regression.

## Patch(+17): slice-level streaming file writeback (sandbox)
- New Object SliceWritebackUnit accepts only internal HubUnit Request
  commit and reads an existing verified SHA-256 journal checkpoint.
- New shared Property SliceFileWritePolicy handles bounded byte-range
  replacement of authorized FileSystemFileHandle content. It checks
  initial file size/mtime and SHA-256 hash of the original range.
- Copy untouched prefix/suffix through 64-KiB Blob chunks around the
  changed slice, write replacement UTF-8 bytes, then close the writer.
- Request exclusive stream and keepExistingData=false to avoid hidden
  full-file copying before streamed assembly. File API behavior still
  depends on browser/OS: no universal atomic file-replace guarantee.
- After close, re-open and byte-compare changed range and all untouched
  portions using source chunk SHA-256 collected before stream close;
  verify file length. This detects unexpected writeback
  content, but cannot prevent external writes outside browser locks.
- SliceEditTransaction.commitWriteback verifies matching dirty durable
  revision before routing to SliceWritebackUnit via Hub; marks clean
  only when write/readback and journal retirement have succeeded.
- SliceRecoveryJournal.retire uses IndexedDBSliceJournalStore
  deleteIfMatch, comparing revision and checksum atomically.
  Failed commit/verification/retirement keeps checkpoint recoverable.
- Limits: <=4 MiB source and replacement slice bytes; 64 KiB read
  chunks for untouched regions, O(full file bytes) read/write/
  readback time, O(slice bytes + chunk bytes) client memory.
- Source files may be large, but overall writeback is not incremental
  in I/O cost; this is a safe foundation rather than optimized
  large-file performance. No external plugin execution or new UI.
- FileDocument remains production save authority; the new writeback
  sandbox is registered but not connected to live document editing.
- Risk: OS-external concurrent updates, quota, permission revocation,
  abrupt browser termination and post-commit crash all need fault
  injection and manual review. Writeback may be ambiguous after close
  even if post-write verification fails; retain journal for recovery.
- Tests: successful size-changing byte splice, original byte
  preservation, dirty close, stale fingerprint, write abort,
  corrupted readback, journal CAS and EHU/Dependency relation.
- Chromium OPFS E2E verifies actual authorized file-handle writing,
  Unicode byte-range replacement, checkpoint cleanup and readback.

## Patch(+18): large-file admission and Piece Tree/B+ page bridge
- Goal: make files larger than the legacy 64 MiB ceiling open
  through the existing editor tab, without loading the whole file.
- New VirtualDocumentPolicy defines size-based admission and
  centralizes the full-buffer threshold as a shared EDPMU Property.
- New VirtualFileDocument OCDA Object extends the existing
  FileDocument black-box contract for read-only, bounded pages.
- Workspace.open calls getFile() for metadata and routes large
  files to VirtualFileDocument. Existing small-file edit/save
  and styling paths remain unchanged.
- VirtualFileDocument.load/page uses existing UTF8SlicePolicy.read
  (64-KiB byte windows, UTF-8-aligned boundaries); builds a
  PieceTreePolicy immutable root and BPlusSliceIndex for each
  loaded page, replacing the previous page only after successful
  read/decode/index construction.
- Existing textarea/tab/line-number DOM is reused unchanged,
  displays one bounded page, and navigates adjacent pages on
  boundary wheel or Alt+PageUp/Alt+PageDown. No new UI layout.
- The visible page is read-only: edits and Save return 409.
  We must not write a partial page as a whole document.
  A second guard blocks FileDocument.save when the actual disk
  size exceeds its safe 64-MiB threshold, even after bad recovery.
- Session snapshots include virtual page index and handle, but
  exclude preview text. On reload, a valid handle reopens the
  virtual page through Hub. Without a handle, the virtual tab
  cannot be restored, rather than creating an unsafe full doc.
- Load progress reports the current page request (0–100%),
  not whole-file residency. Offscreen preview is replaced,
  not retained as an ever-growing string.
- Performance: per page at most ~64 KiB UTF-8 source plus
  bounded boundary alignment; immutable tree and B+ creation
  O(page text). File size metadata O(1); navigation O(page).
  Whole-file indexing, global line numbering and editable
  viewport remain for Patch19. Synthetic 65-MiB and real OPFS
  65-MiB browser acceptance test initial scope only.
- Security: no new plugin execution, no invented absolute path
  or credentials. File handle permission is provided by the
  existing user picker. External file fingerprint changes block
  page advancement unless explicit ExternalFirst reload.
- Parallelism: independent document load operations may run
  concurrently, but each document's page swaps remain serialized
  by HubUnit object resource queue; no cross-document global
  synchronization. No direct Object-to-Object bypass.
- Limitations: this begins large-file opening and read-only page
  traversal, NOT a full slice-editable editor, not 1/5-GiB
  validated performance, and not PR8 PASS.

## Patch(+19): editable bounded virtual text and continuous global lines
- Reuses Patch18 VirtualFileDocument and unchanged ClusterOpt textarea UI.
- Edits apply a minimal UTF-16 replace delta to immutable PieceTreePolicy.
  Before publishing a candidate tree, call SliceEditTransaction's
  transactDurable via HubUnit; persist its versioned SHA-256 checkpoint
  through SliceRecoveryJournal. On failure retain the old page.
- A verified Save routes through the existing SliceWritebackUnit by
  SliceEditTransaction.commitWriteback: use original file byte
  [pageStart,pageEnd) and SHA-256 original segment, check file
  fingerprint, stream replacement, verify disk readback, retire
  checkpoint by revision/checksum, then reload the saved page.
- Dirty virtual pages block navigation and closing; Save As remains
  blocked to prevent accidental full-file truncation.
- New shared VirtualPageLinePolicy scans bounded 64-KiB Blob ranges
  to count LF before the page's aligned byte start. The gutter
  displays pageFirstLine + local line offset; the current-position
  indicator uses the same global index.
- Cache completed byte-prefix checkpoints for sequential pages;
  invalidate them after writeback or external file change.
  No full-file text buffers or whole-file DOM line-number lists.
- Recovery snapshots hold only edit checkpoint identifier,
  original file fingerprint, source-region SHA-256, page index and
  byte range, never the
  whole page as an unverified complete document. On reload,
  restoreDurable validates file identity before publishing text.
- Existing FileWorkspace and LinkCore remain the event authorities;
  OCDA relations and failures are logged through HubUnit/OMU.
- IO complexity: page read O(page bytes), each indexed jump O(bytes
  scanned since nearest checkpoint), each Save O(whole file bytes)
  because Patch17 reconstructs/validates the complete file in bounded
  chunks. Page edit O(page code units), bounded by SlicePolicy 1Mi.
- Parallelism: separate document operations may execute concurrently;
  same document HubUnit queue serializes edit/save/page. Journal
  revision CAS prevents stale edits. Global line prefix scans may be
  time-consuming for a cold jump near file end; Patch20 targets
  background indexing and cancelable quick navigation.
- P0 remaining: no full smooth scroll virtualization, no arbitrary
  global line seek, no cross-slice edit spanning multiple pages,
  full OS crash/power-loss recovery not certified, and no 1/5-GiB
  performance acceptance. PR8 remains NOT PASS.
- Tests include UTF-16 emoji+Chinese splice, persistent checkpoint,
  conflict/error 409/503, browser large-file editing and continuous
  gutter, verified Save and checkpoint retirement.

## Patch(+19-Fix1): practical navigation and safe close
- Backward page navigation publishes the previous page's last-line
  caret at text.length and UI scrollHeight; forward navigation
  anchors at the page's first line, scrollTop 0. No UI redesign.
- Dirty virtual tab Close shows shared-language native confirm;
  Cancel keeps journal and tab unchanged. Confirm dispatches an
  internal Hub request to save, then closes only on verified success.
- Existing synchronous FileWorkspace.close remains synchronous for
  all clean/small files. The dirty virtual branch delegates to
  saveVirtualBeforeClose for asynchronous transactional writeback.
- Save still uses bounded stream/readback+checkpoint retirement; no
  partial-page whole-document overwrite or unconditional discard.
- Chromium 65 MiB OPFS regression waits for complete 64 KiB page
  before equal-size replacement, asserts original file length
  survives, then verifies Ctrl+S/Close and dirty cancel/confirm.
- CPU/memory: navigation has O(page bytes) editor rendering;
  writeback remains O(full source bytes) I/O, O(slice + block hashes)
  bounded RAM. No change to maximum slice budget.
- Race: one document's HubUnit serializes save/close; unsuccessful
  save throws EHU, retaining dirty tab and journal. Cross-tab file
  writes remain a separate P0 requirement.

## Patch(+19-Fix2): unblock real large-file Save and Close
- Existing FileWorkspace.closeMany and closeAll returned EHU409 for
  any dirty virtual document. Instead call saveVirtualGroupBeforeClose,
  preserving synchronous clean-file lifecycle and the original UI.
- Before removing a tab, sequential Hub-routed file saves must
  finish with successful byte readback and journal retirement.
  A cancelled request leaves all tabs; a mid-batch failure leaves
  all tabs and any uncommitted journal, even if an earlier file saved.
- Real local file write permission is requested from direct UI
  activation for Save/Close/CloseAll, before queued Hub work; denial
  preserves dirty text. Never insert await in front of Open/SaveAs
  pickers. Permission errors are logged with EHU 403.
- Verification: 65 MiB OPFS CloseAll exact-size readback,
  cancel and denied permission; existing PR1 synchronous Close.
- Security: no direct Object calls; limits on external OS locks,
  platform support and 1/5GiB latency remain open.

## Patch(+19-Fix3): non-blocking large save and per-file progress
- Begin save in a detached async task so FileWorkspace Hub dispatch
  returns immediately, allowing activate/new tab while a large
  writeback is ongoing. Only a verified commit marks it synced.
- SliceSaveTask is a separate OCDA Object keyed by document id;
  it owns AbortController, revision, task percent and cancellation.
  Cancellation uses a distinct Hub resource key, so a text edit
  can interrupt a Writeback waiting under the document Object.
- SliceFileWritePolicy counts bytes during bounded-prefix/suffix
  stream copy and readback verification. Yield to browser event
  loop after eight 64KiB chunks. Report operation progress only,
  never percent of total file materialized in memory.
- Abort is honored before writer.close; after close, finish readback
  and checkpoint retirement before accepting the next edit.
- FileWorkspace owns saveActive/saveProgress/saveError on each doc,
  enabling correct progress when returning from another tab.
  Paint progress directly on active status widget; NEVER re-render
  tabs or Explorer on every percent increment.
- Main UI observes actual background save: blue state while active,
  percent advances from 0–99, and 100 only on verification.
  Typing sends a Hub-routed cancel to SliceSaveTask before edit.
- Existing PR1 small-file save/close and ClusterOpt UI remain intact.
- Performance: single 65MiB file writes O(fileSize) with fixed
  64KiB I/O blocks, cooperative yielding and O(fileSize/blockSize)
  verification hashes. No claim of OS-atomic multi-GiB writeback.
- Risks: permission denial, quota failure, aborted writes and stale
  file revisions retain dirty journal; no silent truncation.
- Test Node task independence, EHU conflicts, Chromium slow 65MiB
  background write, tab switch/progress restore and edit interruption.

## PR8 Patch(+19-Fix4): multi-page MVCC and fast changed-range saving
- Reference: old ClusterOpt Program/src/fmc/virtual-file-session.js
  retains dirty pages in a Map, avoids unloading them, and streams
  Blob slices directly for unmodified ranges. The older
  storage-progress-tracker.js tracks operations by document.
- Current ClusterOpt2 used a single dirty page, blocked navigation
  before Save, and hashed every untouched 64 KiB block on each Save.
- VirtualFileDocument now holds a bounded dirtyPages Map of source
  byte address, Piece Tree snapshot text, revision and original hash.
  Navigating away keeps the durable slice registration; returning
  uses the latest saved in-memory Piece Tree state, never a disk
  overwrite. Global line positions include earlier dirty LF deltas.
- Recovery snapshot records each page's journal ID, source hash,
  revision, byte range and original/edited LF counts (no full text).
  Dirty pages lazily recover via SHA-256-verified IndexedDB journals.
  Up to 64 simultaneously registered slice revisions are supported
  under current SliceTransactionPolicy.maxOpenSlices; overflow must
  fail without evicting dirty data.
- New SliceBatchWritebackUnit commits all outstanding journal
  revisions through HubUnit in one file operation; only after
  readback of changed regions and size verification are the
  journals retired and transactions marked clean.
- New SliceBatchWritePolicy has two safe paths:
  equal-UTF8-byte-size replacements: FSA createWritable with
  keepExistingData:true and position-specific write calls;
  length-changing edits: copy unmodified ranges as native Blob
  slices in bounded blocks without text decoding or per-block
  JavaScript SHA-256, then insert each dirty revision.
- Source size/mtime and each dirty original region SHA-256 are
  checked before write; edited byte regions + final size checked
  after close. Unchanged ranges rely on source snapshot plus
  FileSystemWritableFileStream/OS semantics, NOT end-to-end
  cryptographic verification of the full file. This is an explicit
  integrity tradeoff relative to old Patch17 full verification.
- The browser may still clone the entire physical file during
  keepExistingData:true; fast application path is not a guarantee
  of O(changed bytes) physical disk I/O or atomicity on OS crashes.
- Existing background Save, per-document progress and separate
  SliceSaveTask cancellation remain. Cancellation before close
  aborts the writer and retains all dirty journals.
- Unrelated Explorer / Open / Activate requests must be able to
  execute concurrently with a long Save without blocking
  Workspace's Hub resource; add actual slow-disk browser tests.
- PR1–PR7 editor UI unchanged; no new visible dev controls.
- Acceptance: two unsaved pages, forward/backward navigation,
  global LF adjustment, equal-length two-range Save, multibyte
  length-changing Save, aborted batch, corrupted source 409,
  EHU + directed dependency, existing PR1 regression.
- Remaining: UI continuous scroll across arbitrary pages,
  1 GiB/5 GiB performance, multi-tab same-file conflict,
  complete cross-document crash recovery and disk power-loss tests.

- Hidden recovered pages are hydrated from IndexedDB and source
  page ranges automatically on Save, under the same Hub MVCC and
  SHA-256 verification, instead of requiring manual page visits.

## Patch(+19-Fix5): repeated virtual page EHU409
- User's console reported repeated `document-1 Response.page 409`,
  `External virtual file changed`, mirrored by Workspace.
- Source analysis: VirtualFileDocument.loadPage rejected every changed
  file lastModified/size fingerprint, even if no dirty page remained.
  Own successful save, external benign replacement, or another
  authorized writer can create a new clean file generation.
- Rebase clean virtual pages on a changed generation by invalidating
  stale line checkpoints and loading the requested page from the
  current Blob. Never do so when dirty journal or recovery entries
  exist, or saveActive indicates a live write.
- Preserve 409 and every source edit when a dirty page sees changed
  disk revision. Explicit keyboard navigation remains retryable.
- UI wheel auto-retry is latched after 409 until an explicit page
  navigation succeeds or another edit occurs. Prevent tens of
  duplicate EHU pairs on one continuous scroll gesture.
- Test clean rebase, changed source bytes/line counts, dirty 409
  without journal loss and no false 409 on next clean page.
- Still open: origin of this user's particular file generation
  change cannot be proven from collapsed log entries alone.
  Must keep source checksum and disk revision observations for
  any future conflict analysis.

## Patch(+20): Explorer filesystem operations
- Bring back Explorer context CRUD using Hub Request/Response.
- Reuse ExplorerEntryPolicy for validation, disallow traversal and collisions.
- Block mutations of open files/subtrees; explicit confirmation for delete.
- File rename fallback only deletes original after byte-for-byte
  readback and source revalidation, using bounded 1 MiB slices.
- O(directory entries) preflight, O(file bytes) file copy.
- Pending: real filesystem authorization, directory paste and native move QA.

## Patch(+21): preserve physical viewport positions
- Save actual scrollTop and scrollLeft, independent of editor caret.
- Restore virtual page index plus pixel coordinates after asynchronous load.
- Retain scroll coordinates across virtual save and document switching.
- Browser clamping after zoom/wrapping changes requires anchored-line QA.
- No new secret storage or network traffic; snapshot payload +8 bytes per doc.

### Patch(+21) viewport line-height extension
- Record last rendered line height, validate <=512 CSS pixels.
- On different zoom, preserve visible row by line-height ratio.
- Wrapped lines and font-width changes still need browser QA.

## Patch(+22): unified slice contract migration boundary
- Export versioned workspace.sliceManifest across HubUnit and EDPMU.
- Describe virtual-page and legacy-compatibility transparently.
- Do not silently drop legacy UX; full-buffer removal is pending.
- Manifest retrieval via File metadata costs O(1) metadata operations.
- Security: no untrusted plugin execution or file content exfiltration.

## Patch(+23): viewport owners and repeat-scroll fast path
- Maintain visible slice budget guards per document, not globally.
- Reuse exact resident plans on repeated scroll without re-decoding.
- Bound owner map size by open documents and visible chunk budget.
- Enforce existing preloaded-first eviction and dirty-protection policy.
- CPU Worker parallelism and rapid-scroll cancellation remain pending.

## Patch(+24): PR8 acceptance gate and unresolved inventory
- Test uniform slice contract and cross-document budget protection.
- Re-run all regression/CI tests and verify previous-main backup.
- Keep six-stage all-text slicing, 1/5 GiB and Windows file locks OPEN
  until actual implementation and performance evidence are available.

### Patch(+24-Fix1): bounded parallel preload and source-of-truth cache
- Add SliceLoader.loadBatch, restricted to 4 unique slices per request.
- Read Blob chunks concurrently, commit memory through Registry serially.
- Report only final resident slices; skipped preloads do not claim success.
- Deduplicate fast wheel requests under stable viewport and failed budget.
- Protect full resident text from speculative demotion.
- Tests: parallel reads, 413 pinned-full behavior, 5 GiB sparse byte seek,
  no repeated unsuccessful preload I/O, EHU/Log relation compliance.
- CPU Worker offloading remains OPEN; Promise.all overlaps Blob I/O only.
- This milestone may be BC merged once CI passes, while PR8 overall remains
  NOT PASS until authoritative all-file slicing and real stress acceptance.

## Patch(+25) legacy parity and file transfer correctness
- Reference original ClusterOpt/Program/src/explorer.js and stylesheet.
- Preserve legacy inline toolbar and existing six/four action tiers
  until UI-compatible integration is verified.
- Perform source/destination integrity validation BEFORE cut retirement.
- Run VTE and browser regression; verify EHU 409 from corrupt output.
- O(file bytes) readback in two 1 MiB buffers, no whole-file JS read.
- Security review: same-folder collision and opened-document guard.
- Outstanding: directory rename and recursive copy/move; old version
  itself explicitly did not support folder copy/move.

### Patch25 Fix1
- Reuse directory context primary first slot for New File.
- Preserve file row Open, directory arrow Expand, existing 4/6
  right-click toolbar geometry and language translation keys.
- Run OPFS Playwright context-creation and legacy PR6 menu tests.


## Patch(+25-Fix1) release asset verification
- Keep centralized version definition in LinkCore only.
- Add a project-relative favicon reference to avoid implicit missing
  root icon fetches on GitHub Pages.
- Audit static index.html links for existence with automated tests.
- Do not attribute an unknown HTTP 404 to a specific URL without a
  Network tab failure record.
- Minimal static-byte cost, no runtime API or privilege changes.
- BC requires backup SHA and both workflows PASS.


## Patch(+25-Fix2) — permission-safe external synchronization
- Use the browser File System Access read permission state to gate
  background checks; never prompt from timer/hidden tab.
- NotAllowedError is not an indicator of data corruption: preserve
  the unsaved buffer/status and pause redundant read attempts.
- Explicit repick of same file restores handle identity without
  creating duplicate tabs; recovery state remains untouched.
- Add Node/VTE tests and update LinkCore version centrally.
- No new Property needed; uses existing Workspace/Document objects.
