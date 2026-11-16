# PR8 ArcD (initial draft)
Object: VirtualFile, SliceLoader, SliceRegistry, SliceProcessor,
EditorViewport, SliceCommitter, WritebackUnit, RecoveryController,
PluginManager.
Property: PieceTreePolicy, BPlusSliceIndex, CacheBudgetPolicy,
HighlightCSSPolicy, SliceMVCCPolicy.
Event chain: UI.scroll -> Hub -> Viewport -> SliceLoader -> Registry
-> PluginManager.process -> UI.render -> Commit -> MVCC
-> Writeback -> Registry.demote.
SubObjects inherit shared UI_COLOR and Language via LinkCore.
EHU statuses: 200 PASS, 400 invalid slice/CSS, 409 MVCC conflict,
413 resource budget, 500 write failed, 503 storage unavailable.
All independent slices may be scheduled concurrently; same slice
mutations are FIFO with generation/version fencing.

## Patch(+1): new property and event chains
New: EditorViewportPolicy, registered once by LinkCore/EDPMU.
UI scroll -> EditorInteractionPolicy.guideWindow -> EditorViewportPolicy
.guidePosition -> tabGuide viewport. No Object data mutations.
Workspace document status -> UI -> EditorViewportPolicy.progress
-> progressFill[data-status], progressText.
VTE.create -> VTE.act -> HubUnit -> VTE target response -> OMU logs.
Invalid target/denied call -> EHU failure -> OMU log.
EHU cases: 200 valid, 404 unknown Object, 400 bad request,
503 unavailable storage (only in future slice implementation).
No slice loads, plugin execution or writeback in this patch.

## Patch(+2) VTE relation
VTE.actor -> Hub -> Explorer.importFolder/list/reorder/closeRoot.
VTE.actor -> Hub -> FileTypeManager.add -> EDPMU shared property.
Responses: explorer/file-types -> VTE.actor; code 10 / 01.
Invalid extension -> EHU 400; closeRoot must not modify disk.

## Patch(+3) EventChain
UI scroll -> EditorInteractionPolicy.guideWindow(rawIndents)
-> DFOM-style text/Tab spans -> EditorViewportPolicy.guidePosition
-> mirror translateX and pseudo-element dashed line. No disk mutation.

## Patch(+4): objects/properties/event chain
Object: SliceRegistry (virtual registration, load, read, demote,
viewport, dirty marker, memory limit).
Property: SliceBudgetPolicy, EDPMU registered once by LinkCore.
UI/Loader -> Hub -> SliceRegistry.registerVirtual -> descriptor only.
Loader -> Hub -> SliceRegistry.load -> SliceBudgetPolicy.evictions
-> evict clean nonvisible -> materialize slice.
EHU: 400 invalid descriptor/limit, 404 missing ID, 409 dirty conflict,
413 insufficient cache budget. No disk writes or data loss.

## Patch(+5) EventChain
File.Tool.Plugin.Performance -> UI -> Hub -> SliceRegistry.setLimit
-> SliceBudgetPolicy.evictions -> localStorage preferences.
On reload SliceRegistry initializes from localStorage after registration.
Highlighter entry disabled until plugin processor Object is installed.

## Patch(+6): Object / Property / EventChain / EHU
- New Object: PieceTreeIndex (Hub-routed request API and immutable root).
- New Properties: PieceTreePolicy, BPlusSliceIndex; EDPMU once each.
- Request.insert/remove -> Hub -> PieceTreeIndex -> PieceTreePolicy
  -> new immutable tree root -> revision increment -> OMU Log.
- Request.locate -> Hub -> PieceTreeIndex -> lazy index build
  -> BPlusSliceIndex.seek -> Response -> OMU Log.
- EHU: 200 success, 400 invalid offset/range, 409 stale revision.
- Index rebuild O(P) after mutation; seek O(log P). UTF-16 positions.
- Integration with SliceRegistry and disk-backed virtual layer deferred.

## Patch(+7): Object / Property / EventChain / EHU
- Object: SliceLoader; Property: UTF8SlicePolicy (EDPMU/LinkCore).
- Blob open -> Hub -> SliceLoader.open -> virtual metadata (no read).
- Load(index, mode) -> Hub -> SliceLoader -> UTF8SlicePolicy.read
  -> Blob.slice aligned to UTF-8 boundaries -> Hub -> SliceRegistry
  registerVirtual/load -> Hub response -> OMU Log/EHU.
- Error matrix: 200 success, 400 bad input/range, 404 missing file,
  409 duplicate file or dirty-registry conflict, 413 cache budget,
  422 malformed UTF-8; errors propagate through HubUnit.
- Same loader Object operations currently serialized by scheduler;
  no parallel per-slice API claim until dedicated resource keys.
- Planned Plugin chains: SliceProcessor.process and
  EditCommitter.process; disable defaults only with clear fallback
  and documented data-integrity/security consequences.

## Patch(+8): UI facade and FileTypeManager parity
- UI.Plugin.open -> modal -> UI.Plugin.performance -> HubUnit
  -> SliceRegistry.list/setLimit -> OMU response.
- UI.BlockedFileTypes.replace -> HubUnit -> FileTypeManager
  -> FileTypePolicy.normalize/sanitize -> EDPMU.SharedProperty
  -> Explorer projection -> OMU dependency/log.
- EHU: 200 successful operations, 400 invalid extension,
  404 original missing, 409 duplicate replacement, 413 budget limit.
- Plugin API markdown is downloadable documentation; no new Object
  executing third-party code, so no untrusted JS in this patch.

## Patch(+9) EHU and UI EventChains
- UI.Plugin.category -> local panel state; no false runtime request.
- UI.Plugin.performance -> Hub -> SliceRegistry.list/setLimit -> OMU.
- UI.BlockedTypes.edit -> legacy prompt -> Hub -> FileTypeManager.replace
  -> FileTypePolicy validation -> EDPMU.BlockedFileTypes -> Explorer.
- Request/Response: valid=200; invalid extension=400;
  missing old extension=404; duplicate replacement=409.
- All user-facing color/locale uses shared UI_COLOR/Language properties.
- No new Property/Object introduced, global registry unchanged.

## Patch(+10): workbench tool window Object and EventChain
- New Object: ToolTabManager (UI-visible read-only tool lifecycle).
- New Property: ToolTabPolicy, registered by LinkCore once.
- UI.PluginButton -> HubUnit -> ToolTabManager.open -> OMU 200.
- UI.ToolTab -> Hub -> ToolTabManager.activate/move/close -> OMU 200.
- UI.FileTab -> Hub -> ToolTabManager.deactivate -> Hub ->
  FileWorkspace.activate -> OMU 200, directed relations 10/01.
- UI.PluginWindow.Performance -> Hub -> SliceRegistry -> OMU.
- Error: 400 malformed/unknown action or invalid position;
  404 activation/movement of closed tool. Failures always EHU.
- ToolTabPolicy computes a projection of file IDs plus one tool ID;
  no FileDocument is allocated and workspace snapshots are unaffected.
- Same ToolTabManager resource key remains FIFO; workspace file IO
  remains independently scheduled and protected by existing policies.

### Patch(+10) recovery EventChain
- UI.load -> SessionRecovery.restore(FileWorkspace) ->
  sessionStorage.tool-view -> Hub -> ToolTabManager.restore ->
  ToolTabPolicy.validatePosition -> UI.render -> OMU.
- 400 invalid saved state, 503 blocked sessionStorage. No file mutation.

## Patch(+11): new Object, Property and EventChain
- New Object: ViewportSliceController, Implementation/object/
  ViewportSliceController.js; Public API open/describe/navigate.
- New shared Property: ViewportSlicePolicy (EDPMU via LinkCore).
- UI/Agent -> Hub -> viewport-slices.open -> Hub -> slice-loader.open
  -> Blob metadata only -> OMU Log/Response.
- viewport-slices.navigate -> ViewportSlicePolicy.plan -> Hub ->
  slice-registry.setViewport -> Hub -> slice-loader.load(full)
  -> Hub -> slice-registry.setViewport(visible IDs) -> Hub ->
  slice-loader.load(preloaded) -> Hub -> slice-registry.demote(clean)
  -> OMU Logs/EHU and dependency Request 10, Response 01.
- EHU: 200 success, 400 invalid viewport, 404 absent file,
  409 dirty-state conflict, 413 resident budget, 422 UTF-8 decode.
- Plugin category dropdown is local UI state; no cross-Object call.
- Main editor remains full-buffer. Future: viewport pixel mapping,
  cancellation/generation protection and true slice editor.

## Patch(+12): Object / Property / EventChain / EHU
- New Object: VirtualLineIndex, open/locate/range/describe. Owns
  private Blob pointer, sparse checkpoint list and scan watermark.
- New Property: LineAddressPolicy, EDPMU-registered by LinkCore.
- UI/VTE -> HubUnit -> virtual-line-index.open -> Blob metadata
  only -> OMU response 200 without reading text.
- UI/VTE -> Hub -> virtual-line-index.locate/range
  -> LineAddressPolicy.scan(64 KiB, yield) -> sparse checkpoint
  -> OMU Log and response. Request/Response relation 10/01.
- UI/VTE -> Hub -> viewport-slices.navigateLines
  -> Hub -> virtual-line-index.range -> ViewportSlicePolicy.bytePlan
  -> Hub -> SliceLoader.load -> Hub -> SliceRegistry.setViewport/load
  -> OMU dependency/EHU.
- Failure status: 400 invalid range, 404 missing document,
  409 repeated open, 416 absent line, 413 memory budget,
  422 data read error, 503 storage unavailable.
- Multi-object dependency chain is observable in real VTE.
- Two existing editor limitations remain: no real viewport DOM
  binding and no safe edited-slice writeback or reload recovery.

### Patch(+12) close/release EventChain
- UI/VTE -> Hub -> viewport-slices.close -> Hub -> slice-loader.close
  -> Hub -> slice-registry.list (preflight dirty) -> Hub ->
  slice-registry.release(clean) -> Hub -> virtual-line-index.close.
- Status 200: close complete; 404: document missing;
  409: dirty, preserve all Blob and index state for recovery/writeback.
- OMU records directed dependencies at every hop. No SendTo.

### Cleanup authorization / EHU
- UserAPI rejects direct slice-registry.release,
  slice-loader.close, virtual-line-index.close (403).
- Authorized user request goes through viewport-slices.close,
  which dispatches trusted nested Hub Requests to components.
- EHU/Log records are inspected in a detached real-object VTE.

## Patch(+13): viewport geometry / EventChain / EHU
- New shared Property: ViewportLinePolicy, registered once through
  LinkCore EDPMU; no new Object or duplicate global Property.
- UI/VTE -> HubUnit -> ViewportSliceController.navigateViewport
  -> ViewportLinePolicy.range -> VirtualLineIndex.range
  -> ViewportSlicePolicy.bytePlan -> SliceLoader -> SliceRegistry
  -> HubUnit Response / OMU Log and directed Dependency.
- Status 200: valid line-indexed navigation; 400: malformed geometry
  or excessive rows; 404: no viewport document; 416: line past EOF;
  413: resident budget; 422: malformed UTF-8 or failed read.
- No direct editor UI integration, no unsafe mutation, no writeback.
- Same document route remains serialized by Hub; clean preloads may
  be evicted, dirty slices remain protected.

## Patch(+14) Object / EventChain / EHU
- New Object: EditorViewportObserver. Existing shared properties:
  ViewportLinePolicy and DocumentStatus; no new global property.
- UI.render/scroll -> debounce and serialize -> HubUnit ->
  EditorViewportObserver.attach(id, Blob) -> HubUnit ->
  ViewportSliceController.open -> SliceLoader.open +
  VirtualLineIndex.open -> OMU Log.
- UI.scroll/zoom -> HubUnit -> EditorViewportObserver.navigate ->
  ViewportSliceController.navigateViewport -> ViewportLinePolicy.range ->
  VirtualLineIndex.range -> SliceLoader.load -> SliceRegistry residency
  -> Hub Response -> OMU Log/Dependency.
- UI.input/dirty/tool-tab/switch -> HubUnit ->
  EditorViewportObserver.detach -> ViewportSliceController.close ->
  SliceLoader.close (dirty preflight) -> VirtualLineIndex.close.
- Errors: 400 invalid payload/geometry; 404 missing document;
  409 stale/dirty observation or protected dirty slice;
  413 memory admission, 416 line out of range, 422 encoding.
- All write operations remain with FileDocument; shadow observer has no
  edit/save API. No User API can directly release protected dirty slices.

## Patch(+15): atomic slice transaction EventChain and EHU
- New Object: SliceEditTransaction (volatile sandbox, not editor).
- New Property: SliceTransactionPolicy (LinkCore/EDPMU Public).
- UI/VTE -> HubUnit -> SliceEditTransaction.open -> PieceTreePolicy.insert
  -> OMU 200; duplicate ID -> EHU 409.
- UI/VTE -> HubUnit -> SliceEditTransaction.transact ->
  SliceTransactionPolicy.checkOperations -> PieceTreePolicy
  immutable candidate edits -> revision compare -> atomic root publish ->
  invalidate BPlusSliceIndex cache -> OMU Request/Response + Dependency.
- UI/VTE -> HubUnit -> SliceEditTransaction.read/locate ->
  PieceTreePolicy / BPlusSliceIndex -> OMU.
- UI/VTE -> HubUnit -> close -> EHU 409 if dirty, otherwise 200.
- 400 malformed ID/ranges/operations; 404 missing slice;
  409 stale revision or dirty close; 413 exceeds slice budget.
- Hub's current scheduler serializes this Object's actions (safe,
  conservative). Per-slice resource-key parallelism requires redesign
  and tests; no unsupported performance claims.
- No connections to FileDocument, persistence, disk or Plugin hooks.

## Patch(+16): new Object, shared Property and EventChains
- Object: SliceRecoveryJournal (storage ownership, EHU/Log).
- Storage adapter: IndexedDBSliceJournalStore, independently testable.
- Shared Property: SliceJournalPolicy; registered exactly once through
  LinkCore EDPMU and listed in 全域屬性清單.md.
- UI/VTE -> Hub -> SliceEditTransaction.transactDurable ->
  SliceTransactionPolicy + PieceTreePolicy candidate ->
  Hub -> SliceRecoveryJournal.persist ->
  SliceJournalPolicy.seal(SHA-256) ->
  IndexedDBSliceJournalStore.put (transaction complete) ->
  Hub Response -> publish immutable Piece Tree root/revision ->
  OMU Log + directed Dependency (Req=10, Rep=01).
- UI/VTE -> Hub -> SliceEditTransaction.restoreDurable ->
  Hub -> SliceRecoveryJournal.restore -> IndexedDB.get ->
  SliceJournalPolicy.verify -> rebuild Piece Tree ->
  preserve journal revision/dirty flag -> OMU Log.
- UI/VTE -> Hub -> SliceRecoveryJournal.discard/persist
  -> EHU 403 (not UserAPI); privileged internal policy needed
  before future writeback paths may discard.
- Failure EHU: 400 validation, 403 unauthorized, 404 missing,
  409 stale checkpoint/dirty close, 422 hash/schema mismatch,
  503 unavailable IndexedDB/crypto.
- Parallelization: one SliceEditTransaction resource currently FIFO
  under HubUnit; independent-object operations may proceed in parallel.
  IndexedDBSliceJournalStore.putIfNewer checks expected revision and
  writes in one readwrite IndexedDB transaction across browser tabs.
  Future end-to-end file writeback still needs crash/recovery tests.
- Slice journal and actual FileSystemHandle are separate; Patch17
  must coordinate atomic writeback before any checkpoint discard.

## Patch(+17): slice writeback EventChain / EHU / Object graph
- New Object SliceWritebackUnit, OCDA UserAPI=[], AgentAPI=[].
  New shared EDPMU Property SliceFileWritePolicy.
- UI/VTE -> HubUnit -> SliceEditTransaction.commitWriteback
  -> verify dirty+durable+revision -> HubUnit ->
  SliceWritebackUnit.commit -> HubUnit ->
  SliceRecoveryJournal.restore -> SliceJournalPolicy.verify SHA-256
  -> SliceFileWritePolicy.commit -> authorized FileSystemFileHandle.
- Write flow: verify file fingerprint and old byte-range checksum ->
  exclusive createWritable -> copy prefix (64 KiB slices) ->
  replacement text UTF-8 -> copy suffix -> close ->
  reopen and verify changed bytes plus pre-close source-chunk hashes
  (without relying on old Blob snapshot) -> HubUnit ->
  SliceRecoveryJournal.retire -> IndexedDBSliceJournalStore
  deleteIfMatch (revision+checksum same transaction) ->
  SliceEditTransaction.clean -> OMU Log/Dependency.
- EHU 400 invalid range/handle, 403 direct User/Agent invocation,
  404 checkpoint missing, 409 revision or source conflict,
  413 too-large edited byte range, 422 readback/corrupt bytes,
  503 storage/write failures. Failures must leave dirty edit
  and recovery journal, unless revision has already advanced
  elsewhere (in which case the latest journal is retained).
- Relation: nested Requests 10 / Responses 01 via HubUnit.
  One shared writeback Object serializes same-origin operations;
  cross-origin OS writes cannot be made atomic by this API.
- No changes to FileDocument.save, root UI or existing Plugin menu.

## Patch(+18): VirtualFileDocument / Property / EventChains / EHU
- New OCDA Object: VirtualFileDocument (subclass of FileDocument;
  separate source and published program contract). No new UI.
- New shared Property: VirtualDocumentPolicy, registered once by
  LinkCore EDPMU. Reuses existing UTF8SlicePolicy,
  PieceTreePolicy, BPlusSliceIndex and DocumentStatus.
- UI -> HubUnit -> FileWorkspace.open -> handle.getFile metadata
  -> VirtualDocumentPolicy.isVirtual -> new VirtualFileDocument
  -> URU register -> HubUnit -> VirtualFileDocument.load
  -> UTF8SlicePolicy.read(byte-slice) -> PieceTreePolicy root
  -> BPlusSliceIndex.build -> bounded text to existing textarea
  -> OMU Log / Response / Dependency.
- UI editor wheel/Alt+PageDown -> HubUnit -> FileWorkspace.page
  -> HubUnit -> VirtualFileDocument.page
  -> fresh Blob slice -> immutable tree + B+ swap ->
  UI render existing textarea + page local lines.
- User edit/save -> HubUnit -> VirtualFileDocument rejects EHU 409;
  FileWorkspace.save and FileDocument.save also forbid accidental
  full-file overwrite of virtual/large source.
- Reload -> SessionRecovery.restore -> FileWorkspace.restore ->
  VirtualFileDocument -> HubUnit.load(index) from retained
  authorized handle. Recovery snapshot never stores preview as
  a complete document; missing handle skips virtual tab.
- 200 page read; 400 invalid page; 409 source fingerprint conflict,
  partial editing or save; 422 invalid UTF-8; 503 stale/missing
  handle. All failures logged by HubUnit EHU.
- Relation: workspace -> virtual document Request 10, inverse
  Response 01; independent open may parallelize, same doc pages
  serialized. Property lookup always HubUnit/EDPMU.
- Deferred Patch19: global line-position map, true virtual
  text render, editable Piece Tree, MVCC journal/writeback
  binding with UTF-16/UTF-8 offset synchronization.

## Patch(+19): editable virtual pages and line index
### Objects / Properties
- Reused Object: VirtualFileDocument, FileWorkspace,
  SliceEditTransaction, SliceRecoveryJournal, SliceWritebackUnit.
- New shared immutable EDPMU Property: VirtualPageLinePolicy.
- Existing PieceTreePolicy and BPlusSliceIndex maintain page-level
  immutable text and offset lookup. UTF8SlicePolicy owns aligned
  source byte ranges, SliceFileWritePolicy owns byte writeback.
### Event Chains (all through HubUnit)
1. UI.edit -> VirtualFileDocument.edit -> calculate minimal UTF-16
   splice via VirtualPageLinePolicy -> SliceTransactionPolicy.apply
   immutable candidate -> HubUnit -> SliceEditTransaction.transactDurable
   -> HubUnit -> SliceRecoveryJournal.persist -> IndexedDB CAS ->
   publish page Tree/B+ and status yellow -> OMU Log/Dependency.
2. UI.save -> FileWorkspace.save -> HubUnit ->
   VirtualFileDocument.save -> SliceEditTransaction.commitWriteback ->
   HubUnit -> SliceWritebackUnit.commit -> SliceRecoveryJournal.restore
   -> fingerprint+source hash check -> bounded exclusive file stream
   -> verify all written bytes -> journal CAS retirement ->
   status green -> bounded reload page and global line checkpoints.
3. UI.page -> FileWorkspace.page -> VirtualFileDocument.loadPage
   -> block if dirty (EHU409) -> aligned Blob read ->
   VirtualPageLinePolicy.prefix LF scan from nearest checkpoint
   -> PieceTreePolicy/BPlusIndex -> existing editor render ->
   global gutter, current operation progress.
4. SessionRecovery -> FileWorkspace.restoreSnapshot ->
   VirtualFileDocument.pendingRecovery (id, revision, fingerprint,
   page byte addresses, source hash) -> HubUnit -> SliceEditTransaction.restoreDurable
   -> SHA-256 verify -> source fingerprint match -> publish dirty Tree
   or error without discarding journal.
### EHU
- 200 accepted page edit/save/line scan; 400 invalid page/range;
  409 dirty navigation, stale MVCC revision, external file mismatch;
  413 excessive slice data; 422 invalid UTF-8 or corruption;
  503 inaccessible storage, missing cryptography or write failure.
- Relation codes through HubUnit: outgoing Request=10,
  incoming Response=01; bidirectional relationships=11.
### Isolation
- A dirty page may not be evicted or closed. UserAPI is narrow;
  low-level writeback remains internal (no direct user API).
- No independent new visual UI, no direct invocation of other
  Objects outside the Hub.

## Patch(+19-Fix1) EventChain and relation
UI wheel/Alt+PageUp -> HubUnit -> FileWorkspace.page ->
  VirtualFileDocument.page -> oldIndex comparison ->
  pageEntryEdge=end / cursor=text.length -> original textarea
  scrollHeight & gutter synchronization -> OMU Response200.
UI wheel/Alt+PageDown follows the same chain but
  pageEntryEdge=start / cursor=0 / scrollTop=0.
UI Close(dirty) -> HubUnit -> FileWorkspace.close ->
  EDPMU Language.translate -> native confirm -> (cancel: false)
  -> FileWorkspace.saveVirtualBeforeClose ->
  HubUnit -> VirtualFileDocument.save -> SliceEditTransaction
  -> SliceWritebackUnit -> verified byte stream and checkpoint
  retire -> FileWorkspace.close(clean synchronous path) ->
  URU unregister -> OMU Response200.
- Negative: denied confirmation leaves tab+checkpoint untouched;
  failed writeback returns EHU with 409/422/503 and leaves dirty.
- Clean small-file close remains synchronous unchanged, preventing
  regression in PR1's application and testing contracts.
- Relation Request=10, Response=01 across routed Object pairs.

## Patch(+19-Fix2): Save/Close EventChain and EHU
UI Save/Close/CloseAll (transient user activation)
-> FileSystemHandle.requestPermission(readwrite) when needed
-> HubUnit Request -> FileWorkspace.close/closeMany/closeAll
-> EDPMU Language confirmation
-> FileWorkspace.saveVirtualGroupBeforeClose
-> HubUnit Request -> VirtualFileDocument.save
-> SliceEditTransaction.commitWriteback (revision CAS)
-> SliceWritebackUnit.commit (readback/checkpoint retirement)
-> success: unregister group and OMU Response200
-> failure: preserve tabs/checkpoints and OMU EHU.
- 403 write permission denied; 409 changed source/revision;
  422 readback integrity mismatch; 503 file/system failure.
- Relation Object Request=10, Response=01. No direct sibling
  Request path or SendTo; same-workspace close must remain serialized.
