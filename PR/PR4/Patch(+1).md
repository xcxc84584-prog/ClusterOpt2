# PR4 Patch(+1) — Standard development foundation

Date: 2026-11-16
Status: DOCUMENTATION FOUNDATION ONLY — PR4 NOT PASS.

## Problem
PR4 was previously marked incomplete because standard extensible development rules
were not established. Need a durable, versioned and reviewable baseline.

## Changes
- Created PR4 Plan.md: requirements, knowledge, data/load, parallelization, security and acceptance gates.
- Created PR4 ArcD.md: candidate objects/properties, EHU table, relation codes and event chains.
- Created versioned handoff with mandatory read-before-write checklist.
- No UI changes; no feature code copied or rewritten; no tests claimed.

## Existing source inspection
ClusterOpt2 index.html uses legacy CSS and current main.js.
FileWorkspace currently supports new/open/activate/close/save; no closeAll.
LinkCore advertises SystemVersion = 0.0.3-pr3.patch2.
README and the global property registry still have older status statements:
they must be reconciled in a later patch, not treated as authoritative PASS evidence.
Original ClusterOpt root index.html redirects to Program/?v=0.0.69;
this is NOT by itself proof of the Chrome/Edge ClusterOpt2 mismatch cause.

## Next
Patch(+2): implement Close All safely after updating translated UI strings and tests.
Patch(+3): implement tab drag reorder with pointer events.
Patch(+4): shared StoragePriority + external mutation reconciliation and tests.
Separate cache/deployment investigation and proof across Chrome and Edge.
Update Plan/ArcD/hand-off for EVERY patch.

## Verification
Document review only. npm run check / e2e NOT EXECUTED for this patch.
EHU and relation functional tests: NOT EXECUTED.
