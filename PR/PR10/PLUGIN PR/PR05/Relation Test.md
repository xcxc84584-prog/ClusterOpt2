# PR05.01–03 Relation Test

Tests: plugin-pr05-route-transactions.test.js (Node/VTE surrogate). Validate immutable historical route snapshot; no mutation until commit; stale transaction 409; malformed 400; capacity 429; invalid operation 404/412; EHU fail retention. Existing PR04 routing and Chromium tests remain required. Manual File System Access not relevant to this patch.
