# PR23 Patch(+9) — Browser VTE Startup/Reload and Legacy Schema Safety
Date: 2026-11-19
State: Draft milestone, no main merge or product version release.

## Implementation
1. `UICOContractCompatibilityPolicy.compare`: unchanged capability-only legacy snapshots are UNVERIFIED (LEGACY_SCHEMA_NOT_VERIFIED), not false PASS. Breaking removal/capability changes are still FAIL.
2. `Implementation/tests/uico-vte-runner.test.js`: updated legacy snapshot assertions.
3. `Implementation/e2e/pr23-uico-vte.spec.js`: browser startup version-change trigger, one OMU event, console manual call, and same-version skip.
4. `Implementation/e2e/playwright.config.js`: optional `CLUSTER_E2E_CHROMIUM_PATH`; no absolute path committed.

## Checks actually run via X2
- Node focused: 18/18 PASS, FOCUSED_EXIT=0.
- Browser startup/reload: 2/2 PASS, Playwright reporter.
- Browser PR23.1 native UI inventory smoke: 1/1 PASS, Playwright reporter.
- `npm ci` unavailable: repository has no lockfile in this Draft branch. Installed `@playwright/test@1.56.0` locally using `--no-save --package-lock=false` (untracked machine state only).
- Bundled Playwright headless shell unavailable. Tests ran using existing system Chrome through environment variable.
- Full `npm run check` rerun produced no verifiable terminal exit; NOT counted as passed. Prior Patch(+8) full test report had four failures (three affected suites subsequently 16/16 PASS, sparse backing probe unresolved).

## Limitations
- No full CI green, browser matrix, or recovery validation yet.
- This does NOT enable native UI Create/Update/Delete, plugin extension CRUD or individual UI object registration.
- Contract comparator detects canonical metadata changes, not full semantic equivalence/accepted payload sets.
- No secrets, machine-specific paths or browser test prompts added to product UI.

## Follow-up
- Run full test/CI in a reliable terminal session and diagnose sparse-filesystem allocation assumption.
- Browser-negative fixtures for response validation, malformed storage, error/retry lifecycle.
- PR23.1 runtime UI-to-UISP identity reconciliation, PR23.4 CRUD, PR23.5 API List, PR23.6 registration, PR23.8 integration.
