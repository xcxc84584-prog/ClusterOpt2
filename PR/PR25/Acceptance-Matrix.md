# PR25 — 48 acceptance conditions

IMPLEMENTED = a feature with automated test path, NOT final acceptance.
PARTIAL = incomplete coverage or independent acceptance outstanding.

| Module | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| PR25 | IMPLEMENTED audience | IMPLEMENTED five kinds | IMPLEMENTED metadata | IMPLEMENTED states |
| AL02 | PARTIAL request inventory | PARTIAL response inventory | IMPLEMENTED schema constraints | PARTIAL errors/recovery |
| AL03 | IMPLEMENTED calls | IMPLEMENTED Host/Worker | PARTIAL action-specific examples | IMPLEMENTED scopes/permissions |
| AL04 | IMPLEMENTED manifest | IMPLEMENTED Worker/UI/CSP | IMPLEMENTED Snapshot/install docs | IMPLEMENTED independent sample |
| AL05 | IMPLEMENTED live grants | IMPLEMENTED read/own/native | IMPLEMENTED ACL/scope/session/revoke | IMPLEMENTED 403/409 |
| AL06 | PARTIAL all Event types | IMPLEMENTED SessionChange payload/order | IMPLEMENTED Worker lifecycle | IMPLEMENTED race/cancel/revision |
| AL07 | IMPLEMENTED bounded pages | IMPLEMENTED lazy descriptors | IMPLEMENTED cursor/revision | IMPLEMENTED selected descriptor |
| AL08 | IMPLEMENTED navigation | IMPLEMENTED source filters/sort | IMPLEMENTED query preservation | IMPLEMENTED in-place refresh |
| AL09 | IMPLEMENTED authorized all kinds | IMPLEMENTED page-independent | PARTIAL missing third-party docs | IMPLEMENTED count/SHA/revision |
| AL10 | IMPLEMENTED copy tools | IMPLEMENTED contract search | IMPLEMENTED contract checker | IMPLEMENTED EHU/status |
| AL11 | IMPLEMENTED registry authority | IMPLEMENTED live revision | PARTIAL legacy migration docs | IMPLEMENTED no guessing |
| AL12 | IMPLEMENTED 100/1000/10000 | IMPLEMENTED stale/race/ACL | IMPLEMENTED export verification | PARTIAL automated proxy, human blind test pending |

Remaining blockers for strict 48/48 merge:
1. Independent review of every intended Plugin Public API's Request,
   Response, permissions, errors, recovery and example documentation.
2. Full authoritative Event inventory; never guess unregistered events.
3. Source/line coverage of all static host contracts and version guards.
4. Independent human third-party documentation-only blind plugin test.
5. Final exact-HEAD 5/5 CI and VTE/E2E PASS.
