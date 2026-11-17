# PLUGIN PR02 — Plan.md
## OCDA scope and per-small-PR gate
PRD → Plan → ArcD → Implementation + Relation Test → Project.
Study latest PLUGIN PR01 handoff and PR9 Patch9, 全域屬性清單 and
unresolved issues before each change. Objects and Properties remain
separate source files. Preserve all original editor/save behavior.

## GitHub design comparisons (before PR02.01 implementation)
1. [AsyncAPI spec](https://github.com/asyncapi/spec/blob/master/spec/asyncapi.md):
   message operations and machine-readable contracts are different
   from transport/authorization. **Improvement:** descriptor metadata
   never grants a HubUnit capability; runtime policy stays authoritative.
2. [VS Code extensions](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensions.ts):
   extension descriptions are separate from their hosts and execution.
   **Improvement:** keep descriptors frozen and side-effect labelled;
   no dynamic third-party code loading.
3. [Eclipse Theia plugin-ext](https://github.com/eclipse-theia/theia/tree/master/packages/plugin-ext):
   plugin host and frontend boundaries are separate.
   **Improvement:** this PR adds only read-only API metadata, not
   unrestricted plugin execution or file handles.

## Implementation
- New independently tested Property: APIDescriptorPolicy.js.
- Validate v1 ID/action/owner, semantic version, visibility, side effects,
  bounded input/output schema subset, optional permissions/deprecation.
- Strict JSON-data-only, safe keys, <=16KiB encoded byte payload,
  max recursion depth/collection size, immutable deep copy on success.
- Register once through LinkCore -> HubUnit -> URU/EDPMU.
- Browser E2E verifies actual LinkCore read and legacy Cluster facade.

## Performance and security
Validation O(input bytes) with bounded input tree; not a full JSON Schema
validator. No file write, route modification or permission escalation.
Contract descriptions may be Public but actual Request/Response remains
subject to AccessPolicy and UserAPI/AgentAPI.

## Merge gate
Exact-head Node checks, real Chromium browser, VTE/Relation, CI,
rollback node. Every subPR must have functional tests, Patch, Plan/ArcD
updates and handoff. PR02 remains OPEN until all subPRs pass.

## PR02.01 Final Gate
Automated exact-head checks passed on SHA `6a2ee4078c5c72cf9b1ef0cdbe94ef3063b31376`.
The Descriptor v1 and read-only shared Property can run in an actual
Chromium-loaded ClusterOpt2 page and a Node 22 environment.
Pending Catalog discovery/permissions are separate subsequent sub-PRs.

## PR02.02 — Upstream comparison and executable improvement
Review [VS Code extension-service descriptions](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensions.ts), [AsyncAPI operations](https://github.com/asyncapi/spec/blob/master/spec/asyncapi.md) and [Theia plugin host](https://github.com/eclipse-theia/theia/tree/master/packages/plugin-ext).
Separate self-description from execution: Object.ocda.APIDescriptors adds metadata
but existing Object.ocda.Request remains the authoritative list of callable
actions; authorization.visibility must agree with declared visibility.
Never synthesize a new privilege from metadata. The internal URU API
`describeAPI` exposes validated immutable descriptors for the later Catalog,
but **must not** be directly exposed as an unauthenticated user-facing method.
Object registration and removal immediately affect the internal index.
Node unit tests and real Chromium tests validate this without changing
the legacy Editor/Save route.

## PR02.02 Final Acceptance
Exact-head commit `a7ba16a5859b0b428059cd71e5be401da6a637f9`:
- [PLUGIN PR02 API Catalog](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020847071): **PASS**
- [OCDA CI](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020847030): **PASS**
- [PR1 OCDA Verification](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020847024): **PASS**
- [Local Agent PowerShell Parse](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020847100): **PASS**

The exact commit passed Node LinkCore registration, Chromium Object
descriptor integration, global regression and Windows validation.
PR02.02 complete; remaining Catalog APIs PR02.03–PR02.10 TODO.

## PR02.03 — Property Descriptor Schema (GitHub design review)
Upstream references:
- VS Code configuration extension point:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/configurationExtensionPoint.ts
- VS Code JSON Schema and settings:
  https://github.com/microsoft/vscode-docs/blob/main/docs/languages/json.md
- Theia PreferenceSchemaService:
  https://eclipse-theia.github.io/theia/docs/next/documents/Migration.html

Architecture improvement: descriptions of name/type/owner/visibility,
readability, writability and human-readable invariants belong to one
EDPMU entry. Do not copy a second registry, expose private metadata to
untrusted plugins, or treat writable=true as permission to invoke updates.
No live validator executes user-provided invariant code.

Implementation:
- Independent immutable PropertyDescriptorPolicy v1, <=8 KiB.
- Optional descriptor on existing HubUnit.registerProperty(name,value,opts).
- EDPMU validates descriptor/name/owners/visibility against actual
  registration and stores a frozen snapshot next to the value.
- Trusted EDPMU.describeProperty returns 404 for absent, null metadata
  for existing legacy registrations. Hub readProperty and AccessPolicy
  remain the sole allowed read path to actual property values.
- Node/Chromium tests and dedicated workflow run on PR branch.
Performance O(metadata size) bounded; no file handle or SaveTask changes.
Gate: exact-head CI + browser must PASS; until then PR02.03 PENDING.
