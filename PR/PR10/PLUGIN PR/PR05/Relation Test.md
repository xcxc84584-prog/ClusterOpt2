# PR05.01–03 Relation Test

Tests: plugin-pr05-route-transactions.test.js (Node/VTE surrogate). Validate immutable historical route snapshot; no mutation until commit; stale transaction 409; malformed 400; capacity 429; invalid operation 404/412; EHU fail retention. Existing PR04 routing and Chromium tests remain required. Manual File System Access not relevant to this patch.

## Patch2 — Inflight and bounded rollback

PR05.04: keep routeVersion pinned synchronously before async work, retain generation-specific in-flight counts and wait for drain without modifying API envelopes. PR05.05: route drain tracking is implemented but cancellation/unregister gating remains pending. PR05.06: explicitly regression-test fail-closed 404 for disabled Provider. PR05.07: bounded immutable history, revalidate rollback under CAS and always generate a new version. PR05.08: test runtime reload clears pending candidates. PR05.09/10: EHU and repeated-version pressure regression. No new workflow, no browser mutation API.
