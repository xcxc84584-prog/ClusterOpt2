# PR23 Patch(+1) — PR23.2 UI API protocol validation
Date: 2026-11-19
Status: IMPLEMENTED AS ISOLATED PROTOCOL POLICY; NOT CONNECTED TO UICO/HUBUNIT RUNTIME

## Changed
- Added `Implementation/property/UIProtocolPolicy.js`: immutable data-only UI Request/Response validator, action-to-required-capability metadata, envelope normalization snapshot, bounds checking and failure codes.
- Added `Implementation/tests/ui-protocol-policy.test.js`: Node native tests for correct requests/responses, invalid caller spoofing, prototype pollution, functions in payloads, oversized batch, stale/invalid revision and error status consistency.
- No new EDPMU Property registration or runtime Object. `UIProtocolPolicy` is a pure internal helper for PR23.3, not `UISP` or a second authority.
- Neither API List nor any public plugin execution path has been modified.

## Validation performed
X2 PowerShell executed Node's built-in test runner against the two files fetched from the PR23 GitHub Draft branch:
- 8 tests, 8 PASS; exitCode=0, stderr empty.
- This is an isolated policy suite, **not** the entire repository `npm run check`, VTE or browser E2E.

## Deferred
- Bind authenticated caller identity in HubUnit; enforce ACL and Relation Code per action.
- Integrate UICO/UISP with actual UI registry, adapter and lifecycle.
- Verify complete UI inventory (PR23.1), API List contract coverage (23.5), VTE startup gate (23.6), browser E2E (23.7).
- Add action-specific authorization for host slots; validity alone must never imply permission.
- In the real implementation, expectedRevision/atomic batch operations must be implemented by UICO rather than assumed from schema alone.

## Recovery and version
Draft branch: `docs/pr23-uico-uisp-plan`.
Source-of-truth product version remains `Implementation/property/ReleaseVersion.js` (0.0.15b at start).
No release bump, no main merge. This patch is a testable protocol component only.
