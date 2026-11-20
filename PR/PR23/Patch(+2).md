# PR23 Patch(+2) — UICO / UISP guarded foundation
Date: 2026-11-19
Status: Partial PR23.3, read-only foundation. Draft, not released.

## Changes
- Added `Implementation/object/UICO.js`: strict OCDA UI-domain Object with `describe` / `list` only. The current list is intentionally empty until each UI Object is migrated. Unimplemented `UI.Create` etc. are not exposed.
- Added `Implementation/property/UISP.js`: reusable immutable geometry, appearance, interaction and accessibility descriptor validation. No DOM access or plugin JS callbacks.
- Updated `Implementation/LinkCore/LinkCore.js`: register UISP once through HubUnit/EDPMU as a read-only global definition and register UICO as a strict Object via URU. No second registry.
- Added `Implementation/tests/ui-control-object.test.js`: URU/EDPMU registration, HubUnit read routing, access denial and immutable geometry validation.
- UICO is the UI API hub, **not** the system Request/Response authority. HubUnit must mediate all future routing to per-UI Objects.

## Verification
- X2 PowerShell cloned the PR23 Draft GitHub branch and ran both PR23 test files.
- Reported 12 PASS / 0 FAIL / 0 skipped. The wrapper returned null exitCode despite the Node reporter showing success; treat as **test reporter PASS, process completion not independently confirmed**.
- Full `npm run check` attempt returned no output and null exitCode; therefore **full check not verified**. Do not claim CI PASS, VTE PASS or E2E PASS.

## Risks and next gates
- UICO does not yet enumerate real UI objects, create controls, dispatch to adapters, or expose requested mutation APIs.
- Integrate contract metadata / API List only after schema agreements; enforce trusted caller and capability permission at each HubUnit hop.
- PR23.1 inventory remains incomplete; PR23.4 per-UI UISP APIs and PR23.6 registration are blocked by inventory.
- Add VTE Event Chain cases and browser UI tests; verify version change detection at PR23.7.
- Product version unchanged; no merge to main.
