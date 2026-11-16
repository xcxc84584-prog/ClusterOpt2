# PR8 Patch(+13) — Viewport geometry interface

## Baseline
- main commit: `34a2804882e55df7aa90892e13f31d7b74d45ce4`
- recovery: checkout the baseline SHA or original main before merge
- branch: `pr8/viewport-geometry-patch13`

## Implemented
- Added pure `ViewportLinePolicy.range()` to map measured viewport
  pixel coordinates to bounded 1-based logical line addresses.
- Registered shared Property in LinkCore and bumped version through
  centralized `SystemVersion` only.
- Added `ViewportSliceController.navigateViewport` Hub-facing action.
  Internally reuses indexed line-to-byte range, bounded bytePlan,
  full/preload residency and EHU/OMU recording.
- Added node:test cases for zoom-equivalent geometry, invalid inputs,
  and the real-Object Hub EventChain. Updated global registry and
  PR8 Plan/ArcD.

## Excluded from this patch
- No editor DOM viewport-to-virtual-Blob lifecycle yet.
- No Piece Tree editing transaction, MVCC writeback, or advanced recovery.
- No custom plugin execution.
- Full-buffer FileDocument remains in service; PR8 is NOT PASS.

## Security / failure cases
- 400: invalid geometry, non-finite pixels or unsafe line span.
- 404: unknown virtual document.
- 416: line range beyond indexed document.
- 413: cache budget.
- 422: malformed data.
- Internal dirty-slice release remains prohibited.

## Tests
- `npm run check`
- `npm run test:e2e`
- `node --test Implementation/tests/pr8-patch13-viewport.test.js`
- VTE: inspect Request/Response EHU and directed Dependency for
  `viewport-slices.navigateViewport`.
- Manual Chrome/Edge: measure zoom, rapid scrolling and ensure legacy
  editor is unchanged. Note: geometry interface is not yet wired to
  the editor's real scroll event.

## Follow-up
Patch(+14): safely bind virtual documents to real EditorViewport while
retaining the old editor behind a feature gate until save and recovery
are transactional and verified.
