# PR23 Patch(+11) — CI Catalog Reconciliation and Crash-Safe VTE Retry
Date: 2026-11-20
State: Draft only; no main merge or release.

## Changes
1. Draft PR #79 first Node suite: 478 tests, 467 PASS / 9 FAIL / 2 SKIP. Eight failures were old catalog API counts following UICO.uiRequest registration. One error misidentified list response as object; a concurrent branch commit fixed this.
2. Updated six legacy Catalog test files without disabling authorization, pagination, documentation or visibility checks.
3. After repair, GitHub OCDA CI at commit 6ac96707206e9cec0505668442cacf5000fe6dfb succeeded: 478 tests, 476 PASS / 0 FAIL / 2 SKIP; 339 sources lint PASS. PR02 catalog-unit, PR03 capability-node and PR01 inventory also succeeded.
4. Persist startup pending before queuing background UICO VTE, and retry previous-incomplete on reload. A crash after openedVersion is saved no longer silently skips the run.
5. Bound and validate stored VTE status/version; corrupt JSON, invalid or oversized records trigger UNVERIFIED/EHU instead of a false PASS. Storage access denial still does not invent a previous baseline.
6. Added Node and Playwright cases for interrupted launch, malformed persistence, and forged PASS metadata.

## Acceptance boundaries
- Green Node evidence above applies only to SHA 6ac9670. New pending/retry changes require their own CI and browser E2E.
- Skipped tests remain skipped and need separate review.
- Complete browser matrix, native DOM inventory/UISP mapping, detailed error/examples API List and recovery gate are outstanding.
- X2 PowerShell remains blocked by Agent pairing HTTP 403; do not claim local test success.
- Preserve Draft PR #79; no merge or version release.

## Regression scenarios
- EC-UI-VTE-09: completed PASS with same-version reload => SKIP.
- EC-UI-VTE-10: interrupted pending after version change => next reload retries once and records OMU.
- EC-UI-VTE-11: malformed / forged persisted PASS cannot suppress testing; return UNVERIFIED/EHU without live DOM changes.
