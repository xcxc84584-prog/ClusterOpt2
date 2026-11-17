# PLUGIN PR03 Patch(+2) — Provider Manifest v1
## Deliverable
New standalone pure ProviderManifestPolicy registered once via HubUnit
to EDPMU. Uses PR03.01 CapabilityIdPolicy and PR02
APIDescriptorPolicy/CatalogVersionPolicy, no parallel registry.

Manifest is a validated, frozen, detached JSON-data-only descriptor:
manifestVersion, providerId, objectId, provides (service, action, SemVer,
inputSchema, outputSchema), requires, permissions, execution
(isolation / concurrency). Strict known keys and size limits.
Invalid structure, executable data, getters, cyclic references, invalid
schema/version, self-dependency, duplicate provided Service and
over-budget declarations are rejected with 400, no partial activation.
Permissions declared here NEVER authorize operations.

## Files
- Implementation/property/ProviderManifestPolicy.js
- Implementation/LinkCore/LinkCore.js
- Implementation/tests/provider-manifest.test.js
- Implementation/e2e/plugin-pr03-manifest.spec.js
- .github/workflows/plugin-pr03-provider.yml
- Updated Plan, ArcD, Relation Test, global Property registry, handoff.

## Upstream comparisons
- https://github.com/microsoft/vscode/blob/main/src/vs/platform/extensions/common/extensions.ts
- https://github.com/eclipse-theia/theia/blob/master/packages/plugin-ext/src/common/plugin-protocol.ts
- https://github.com/asyncapi/spec/blob/master/spec/asyncapi.md

## Limits and non-goals
At most 32 provided services, 64 declared requirements/permissions,
32KiB manifest and bounded schema/recursion depth. No new factory,
ServiceRegistry, dynamic route, sandbox, UI, FileSystem Access or
document mutation. Existing version 0.0.9-pr9.patch9 stays unchanged.

## Gate
Detached VTE / browser / OCDA + Windows exact-head CI.
Checkpoint before Patch2: backup/plugin-pr03-sub01-f501dc6 at
f501dc6a621fc4f2fe28c44f0efcb85883f07dc0.
Keep PR #44 Draft, don't merge until PR03.01–03.10 PASS.
