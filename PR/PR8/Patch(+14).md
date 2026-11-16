# PR8 Patch(+14) — Read-only EditorViewport integration

## Baseline and recovery
- Base: `pr8/viewport-geometry-patch13`
- Patch13 head at branch creation:
  `c7e2e8ab882422ef9165bd10db2b045994814262`
- Patch14: `pr8/editor-viewport-bridge-patch14`
- The production main remains at Patch12 until independently verified.
- Do not merge Patch14 before Patch13; stacked PR dependencies apply.

## Changes
- Added `EditorViewportObserver` as its own OCDA Object, routing
  attach/navigate/detach to the preexisting viewport-slices Object.
- Browser `main.js` observes real scrollTop and clientHeight plus computed
  lineHeight, which reflects zoom, and the real editor line count.
- Requests are debounced 80ms, generation-checked and sequentially queued
  to avoid stale responses and cross-document races.
- The bridge opens a Blob snapshot only for an active clean file backed
  by a browser-authorized FileSystemHandle.
- Dirty, tool-only, external-conflict or closed documents cause detach.
- ViewportLinePolicy now clamps lines to maxLine (1-based).
- Updated LinkCore SystemVersion to 0.0.8-pr8.patch14.
- Added Node unit/Hub tests, Plan/ArcD, global-property inventory.

## Security / data-integrity properties
- Passive only. No text from virtual slices overwrites textarea.
- No writeback or raw file mutations occur from observer.
- Dirty conflict is rejected 409; controller refuses unsafe slice release.
- Errors are EHU/OMU observable without exposing dev prompts in UI.
- Does not run untrusted plugins, inject secrets or absolute paths.

## Event chains
1. Clean editor scroll -> UI debounce -> Hub ->
   EditorViewportObserver.navigate -> ViewportSliceController.navigateViewport
   -> VirtualLineIndex -> SliceLoader/Registry -> OMU Log.
2. Dirty state -> UI -> Hub -> EditorViewportObserver.detach
   -> ViewportSliceController.close -> safe cleanup.
3. Tab switching -> generation invalidation -> queued old detach
   -> new Blob attach -> correct viewport navigation.

## Known limitations
- FileDocument and textarea still hold full text; no virtual-only editor.
- `renderLines` still splits all lines; large text performance is not
  validated or solved by this patch.
- No MVCC writeback/advanced recovery; still PR8 NOT PASS.
- Browser observation may add read work; real latency and memory must
  be measured before enabling full-size virtual editing.
- CI, browser zoom/scroll and VTE acceptance require execution.
- No change to the user-visible Plugin UI.

## Test commands
```shell
npm run check
node --test Implementation/tests/pr8-patch13-viewport.test.js
node --test Implementation/tests/pr8-patch14-observer.test.js
npm run test:e2e
```

## Next phase
Patch(+15): implement slice-edit transaction unit with Piece Tree/B+ and
MVCC; keep legacy edit/save behind a reversible gate until writeback and
recovery are proven with checksums and crash/reload tests.
