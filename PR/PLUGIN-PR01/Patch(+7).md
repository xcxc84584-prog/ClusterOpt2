# PLUGIN PR01 Patch(+7) — bounded 5GiB source adapter
## Problem
Node22's openAsBlob last-page read on a real 5GiB sparse file returned empty data. Real fs.read at offset >4GiB returned the expected END bytes, so the first Patch6 CI failure is test backend-specific.
## Fix
Keep native Blob for <=1GiB. For >4GiB use a file-backed bounded, positioned source exposing size/slice().arrayBuffer(), with strict range checks and max length. Run existing production UTF8SlicePolicy against both backends. Update exact-head test to assert explicit backend identity, plus Plan/ArcD/Relation/PRD/handoff.
## Risk and gate
This validates large-offset I/O and policy decoding on real sparse files, **not** actual 5GiB content in the browser or safe writeback. CI must PASS. No changes to core Hub/editor/writeback.
