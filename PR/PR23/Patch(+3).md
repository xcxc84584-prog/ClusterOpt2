# PR23 Patch(+3) — Four 2-bit UISP API operations
Date: 2026-11-19
Status: SPECIFICATION UPDATE ONLY; no runtime permission changes.

## Requirement amendment
PR23.4 now requires every UI Object to expose standard UISP API operations:
`00` Add plugin-owned extension API;
`01` Delete plugin-owned extension API;
`10` Query API contract;
`11` Update plugin-owned API definition.
The native-environment APIs cannot be deleted unless an exceptional, explicit host authorization allows that exact native API.

## Security and naming
- `UIOperationCode` is a 2-bit action selector, **not** the OCDA `RelationCode` and not a four-bit ACL.
- HubUnit remains authorization and Req/Rep authority; URU registration, OMU Log/EHU remain mandatory.
- Explicitly store provenance `native|plugin`, trusted owner identity, revision, API schema and capability scope.
- 2-bit operation codes cannot express arbitrary subsets of allowed actions; use separate approval flags/scopes.
- `UI.ExtensionAPI` payload is a planned contract, not yet supported by `UIProtocolPolicy`.

## Modified
- PR/PR23/Plan.md: required PR23.4 Add/Delete/Query/Update semantics and acceptance.
- PR/PR23/ArcD.md: Req/Rep schema, Event Chains EC-UI-API-01..08, EHU, parallelism/ownership.
- New handoff PR23.4-draft3.

## Verification
Documentation-only revision. No runtime test or VTE success is claimed.
Main branch and product ReleaseVersion unchanged. Full PR23.4 implementation remains pending.
