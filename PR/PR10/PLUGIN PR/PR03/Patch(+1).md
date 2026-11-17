# PLUGIN PR03 Patch(+1) — Capability ID Policy
## Implementation
- New immutable CapabilityIdPolicy.js pure service ID validator.
- LinkCore registers exactly one Public EDPMU Property via HubUnit.
- No duplicate Object or Service Registry, no privilege expansion.
- checkUnique validates bounded list and returns 409 on collision;
  it does not reserve IDs or block multiple Providers for one Service.
- Node tests validate grammar, abuse, collision, detached real VTE.
- Chromium E2E tests real Hub property and legacy Cluster.api.
- Dedicated GitHub Actions workflow plus global property documentation.

## GitHub architecture review
VS Code extension identifiers and Theia plugin protocol emphasize
explicit stable naming independent of mutable runtime host machinery.
Hence version is separate from identity and no dynamic registry
is added in this subPR.

## Merge / rollback
Branch plugin/pr03-provider-registry begins at merged PR02 main
5191ffc8d1ae7996526b8808bd535a330c1f6269.
Entire PR03 remains Draft, NOT PASS until all 10 subPRs and exact-head
Node / Chromium / Windows CI + restore verification.
