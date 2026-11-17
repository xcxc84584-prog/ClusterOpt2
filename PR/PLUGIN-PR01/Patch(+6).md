# PLUGIN PR01 Patch(+6) — real sparse file address benchmark
## Problem
PR01.08 lacks runtime evidence for 1MiB, 64MiB, 1GiB and 5GiB address arithmetic. Existing browser regression primarily demonstrates ~65MiB OPFS files.
## Changes
Implement `ocda-largefile-probe.mjs` using OS sparse files and production `UTF8SlicePolicy` to read only bounded first/middle/last windows. Add `ocda-largefile-probe.test.js`, CI report `largefile-sparse.json`, and update Plan/ArcD/Relation/PRD/handoff. No production editor/Hub/Save modification.
## Acceptance
Exact-head CI Node22 sparse address test and existing Chromium/Windows regression must PASS. The probe is **not** 5GiB real-content or crash-recovery testing; those remain NOT RUN.
## Rollback
`backup/pre-plugin-pr01-20261117` and original base `96c469ce1f04e9632f767d1762fd2186a13cd0ba`.
