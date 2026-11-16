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
