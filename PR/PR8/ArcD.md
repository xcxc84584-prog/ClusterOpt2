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
