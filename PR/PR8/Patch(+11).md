# PR8 Patch(+11) — Compact Plugin category menu and viewport slice stage

Status: work in PR; PR8 NOT PASS.

## UI change
- File > Tool > Plugin remains a TAB-based read-only tool window.
- Replace persistent four-button category toolbar with one compact
  workbench-local top-right button, expanding a dropdown on demand.
- Selection closes the menu; external click, Escape and tab switch
  also close it. Arrow/Home/End support keyboard operation.
- Uses existing Language and UI_COLOR shared properties.
- No top-level application toolbar changes, no dialog.
- Based on W3C WAI-ARIA Menu Button Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/

## Stage-2 viewport slice integration
- New ViewportSlicePolicy: pure bounded logical slice-index planning.
- New ViewportSliceController OCDA Object: virtual open through
  SliceLoader, full-load visible slices and preload adjacent slices.
- Uses HubUnit to call SliceLoader and SliceRegistry only.
- Clean offscreen slices demoted, dirty full slices protected.
- Memory pressure can omit speculative preloads (413) but cannot
  silently omit requested visible full slices.
- Unit VTE covers virtual-first open, prefetch, viewport navigation,
  stale-index rejection, EHU and directed relation codes.
- Object now registers in live OCDA domain, but the main textarea
  has **not yet** been replaced by a virtualized editor.

## Risks and load assessment
- Each navigate operation is bounded to <=16 visible and <=4
  adjacent slices; slice byte size <=1 MiB as enforced by loader.
- A planning step uses O(visible+adjacent) memory. Cache sweeps
  use registry scans, and dirty slices are never demoted.
- Mapping from actual pixel/line viewport to byte-slice indexes is
  still missing; it must not guess visible ranges from byte offsets.
- Current global viewport registration is single-active-view oriented.
  Multi-file concurrency, cancellation, generation fencing and
  plugin phases 3/5 require subsequent patches.
- No eval/import of third-party code, network execution or secrets.

## Verification and EHU
- 200 open/navigate success; 400 invalid slice indexes;
  404 unknown document; 409 dirty protection;
  413 memory budget; 422 decoding errors.
- EventChain: UI -> Hub -> viewport-slices ->
  slice-loader -> slice-registry -> OMU/EHU.
- Directed VTE relations validate 10 Request and 01 Response.
- Browser CI must cover menu accessibility and legacy file UI.
