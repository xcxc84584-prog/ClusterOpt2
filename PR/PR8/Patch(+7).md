# PR8 Patch(+7) — Virtual Blob Slice Loader

## Scope
- Added UTF8SlicePolicy as a separate shared property.
- Added SliceLoader as an OCDA Object, exposing open/load/describe.
- Blob references remain virtual on open; no full text decoding.
- Loading decodes a bounded range with UTF-8 code-point alignment.
- Loaded text enters SliceRegistry through HubUnit and its cache budget.
- Malformed UTF-8 returns EHU 422; invalid inputs return 400;
  unknown document 404; duplicate document 409.
- Existing main editor UI and data path are unchanged.

## EventChain
UI/test -> HubUnit -> SliceLoader.open -> virtual Blob metadata.
UI/test -> HubUnit -> SliceLoader.load -> UTF8SlicePolicy.read
-> HubUnit -> SliceRegistry.registerVirtual/load -> OMU.
Preloaded slices remain unprocessed and not exposed to editor read.

## Bounds and risk
Each read transfers one requested slice plus UTF-8 alignment bytes.
Current implementation uses Blob.slice, not OS file handle streaming.
The registry's byte limit is still not enforced on the main editor.
Object-level scheduling serializes loader work; per-slice parallel
scheduling, cancellation and viewport logic are subsequent patches.
Open Blob handles remain until page reload: no close or cleanup yet.
No binary encoding fallback is attempted. UTF-8-only at this stage.

## Validation
Node tests cover Unicode/emoji cut points, lazy Blob access,
mode semantics and invalid input. Full CI/browser results required.
Do not merge without verified rollback and green checks.
