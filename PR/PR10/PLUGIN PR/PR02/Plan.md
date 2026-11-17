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
