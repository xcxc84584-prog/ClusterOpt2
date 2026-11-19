# PR23 Patch(+10) — Typed API List and VTE Negative Fixtures
Date: 2026-11-20
State: Draft only; no main merge or release.

## Implemented
1. Fixed UICOContractCompatibilityPolicy so legacy capability-only
   migration cannot mask removed actions or changed capabilities. Such
   changes are FAIL; otherwise migration remains UNVERIFIED.
2. Added regression cases for both breaking changes and safe-unknown
   migration, including status and issue codes.
3. UICO OCDA API descriptors now advertise typed generic envelopes for
   extensionAPI and uiRequest, including required fields, response fields,
   and per-action permission requirements.
4. HubUnit.listActionContracts now projects the declared permissions
   after its existing caller-scoped discovery checks, without granting
   execution authority or adding a parallel registry.
5. Added UICOProtocolFixturePolicy with bounded, side-effect-free
   positive and negative Request/Response fixtures for every declared
   UIProtocolPolicy action. UICOVTERunner runs it alongside the existing
   detached VTE relation checks, recording failures through OMU.
6. Added Node regression tests for catalog fields, schema migration,
   action coverage and malformed responses.

## Evidence and limits
- GitHub code changes committed to docs/pr23-uico-uisp-plan.
- Local X2 PowerShell execution was blocked by Agent HTTP 403 token/pairing
  mismatch. No current-run local Node/VTE/E2E PASS is claimed.
- GitHub CI outcome is pending until a PR-triggered run completes.
- Fixture coverage tests the current runtime policy and selected bad
  envelopes; it is not full JSON Schema equivalence or all runtime effects.
- UI.Batch, per-native-element UISP adapters, runtime DOM inventory
  reconciliation, persistent VTE retry hardening, and browser interaction
  matrix remain incomplete.
- The API descriptor schema subset cannot encode enum, error catalog,
  or code examples. Those remain design work, not verified API coverage.

## Release gate
Keep the major PR Draft and do not merge to main until all required
CI/VTE/browser/recovery gates pass. Do not suppress environment failures
or publish version changes before that point.
