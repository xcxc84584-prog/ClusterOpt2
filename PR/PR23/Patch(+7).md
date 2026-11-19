# PR23 Patch(+7) — Corrected dynamic UI source audit
Date: 2026-11-19
State: Partial PR23.1. Draft branch only.

## Why
The first `pr23-ui-inventory.mjs` scan used a global-state RegExp.test across files, making dynamic-DOM detection skip some files and underreport the count (11 rather than 14).

## Code and files
- Fixed stateless dynamic DOM detection in `scripts/pr23-ui-inventory.mjs`.
- Added a table of JS literal ID assignments and their source locations. Values can be OCDA Object IDs or ID-prefix fragments; they are **candidates only**, not necessarily UI DOM nodes.
- Re-generated `PR/PR23/UI-Inventory.md`.
- Updated `Implementation/tests/pr23-ui-inventory.test.js` to restrict the static ID completeness assertion to the static ID table.
- Added `Implementation/e2e/pr23-ui-runtime-inventory.spec.js` for shell/menu/Plugin Manager DOM snapshot and duplicate-ID smoke verification.
- Updated Plan.md and ArcD.md to distinguish static source, dynamic candidates and browser confirmation.

## Checks
- X2 Node generator: staticIds=86; dynamicSourceFiles=14; 70 JS files scanned; zero duplicate static HTML IDs.
- Node inventory tests 3/3 PASS, explicit TEST_EXIT=0.
- Browser Playwright test **committed but not run** in this patch: no @playwright/test under the X2 temporary clone.
- No full CI/VTE/browser acceptance claimed.

## Unresolved
Inspect runtime control creation and actual plugin-loaded UI; map IDs to OCDA Objects/UISP and HubUnit API contracts. Run Playwright smoke and full E2E before declaring PR23.1 PASS. Main not merged; version unchanged.
