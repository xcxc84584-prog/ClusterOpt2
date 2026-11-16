# PR8 Patch(+22): unified slice contract baseline

## Scope
- Adds DocumentSliceContract property and Workspace.sliceManifest
  Request/Response, registered through LinkCore / EDPMU / URU.
- All document callers receive a versioned descriptor with documentId,
  mode, byteLength, chunkBytes, count, currentIndex and dirty.
- The legacy FileDocument path is explicitly named legacy-compatibility.
- Existing virtual-page mode remains backed by the previous Piece Tree,
  auxiliary B+ index, MVCC Journal and bounded page writeback.

## EventChain
UI / VTE -> HubUnit -> workspace.Request.sliceManifest ->
EDPMU.DocumentSliceContract -> Workspace.Response.sliceManifest ->
HubUnit -> OMU Dependency/Log/EHU -> caller.

## Constraints and performance
- For handle-backed files only file metadata is queried, not file.text().
- Untitled documents measure their existing in-memory text; O(bytes).
- No new plugin execution, key, external path or elevated privilege.
- This is an API compatibility milestone, NOT complete migration of the
  legacy textarea to bounded resident slices.
- Full PR8 target still requires one authoritative sliced edit model
  for small + large files and memory verification under real browser QA.

## Tests
- Unit: manifest contract, EHU404 missing document, directed relations.
- CI must retain PR1–PR7 and PR8 existing tests.

## Status
PARTIAL — user requirement for all files sliced is not yet PASS.
