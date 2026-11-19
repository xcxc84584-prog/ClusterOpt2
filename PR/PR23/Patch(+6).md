# PR23 Patch(+6) — Static native UI source inventory

Date: 2026-11-19
Status: PR23.1 partially implemented; browser runtime audit pending.

## Delivered
- `scripts/pr23-ui-inventory.mjs`: deterministic offline inventory generator.
- `PR/PR23/UI-Inventory.md`: generated component IDs, HTML tag, source line, literal JavaScript references, dynamic DOM modules and open coverage.
- `Implementation/tests/pr23-ui-inventory.test.js`: ensures all HTML IDs appear, there are no duplicate static IDs, and unknown runtime/API status is declared.
- Updated PR23 Plan.md and ArcD.md with inventory methodology, limits and migration mapping.

## Measured scan
- 86 distinct static HTML IDs, 0 duplicated IDs.
- 70 JS source files searched under Implementation/main, object and LinkCore.
- 11 JS files with dynamic DOM construction/insertion patterns.
- UI API coverage: not yet audited. Browser runtime visibility: not yet verified.

## Tests
- X2 PowerShell: 3/3 inventory Node tests PASS, exit code 0.
- Code conventions and syntax check previously PASS for scanner code.
- No full CI, browser E2E, UI runtime inventory or VTE chain PASS claimed.

## Risks / next steps
- Regex scanner is a bounded static aid, not a full HTML parser or runtime DOM enumerator.
- Add browser-based DOM capture of dynamically generated controls including plugin and window states.
- Map stable IDs to OCDA Objects, UISP properties, API descriptors, permissions and EHU/Log.
- Update unresolved tests list and keep native-vs-plugin provenance clear.
- Continue PR23.2/23.3 routing only after confirmed target mappings.
- Draft branch only; main and LinkCore version remain unchanged.
