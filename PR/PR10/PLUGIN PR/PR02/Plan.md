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

## PR02.04 — Live Registry Collection (design review)
Compare VS Code extension Registry (metadata vs execution), AsyncAPI
operation descriptions and Theia plugin host isolation. Unlike an
independent plugin registry, CatalogCollection is a **live read-only
projection** over the authoritative URU and EDPMU. It never retains
an executable Object or Property value, grants permissions or invokes
factories. Collection is bounded to 4096 registered items and takes
O(objects + properties + declared API descriptors); descriptors have
PR02.01/03 validation and immutable copies. Legacy properties without
metadata remain usable and are excluded from documented catalog items.
Dynamic register/unregister is immediately visible. PR02.05 adds
external list/query/pagination; PR02.06 enforces caller projection.
Node and Chromium tests run in dedicated workflow, plus OCDA regression.
PR02.03 exact-head da2672e: dedicated, PR1, OCDA and Windows workflows
all passed on 2026-11-17; checkpoint backup/plugin-pr02-sub03-da2672e.
PR02.04 implementation: pending exact-head CI acceptance.

## PR02.05 — Bounded read-only discovery (GitHub comparisons)
References: AsyncAPI operation descriptions (separate contract from runtime
security), Theia plugin-ext host vs main RPC boundary and VS Code extension
registry. Unlike mutable plugin host indexing, CatalogQuery is an internal
pure query facade over CatalogCollection's frozen on-demand snapshots.
API: list(kind, {offset,limit}), describe(kind,id,owner?), and
query(kind,{owner?,term?},{offset,limit}). Supports API and Property
kinds only. 1–100 page limit, offset 0–4096; invalid selectors 400,
unknown 404, ambiguous API id 409. Results are frozen metadata, not
executable handlers or Property values. No external endpoint before
PR02.06 authorization/visibility projection; no dynamic plugin execution.
Runtime cost O(current snapshot size) per operation, bounded 4096
registry entries and 100 results per page; page drift across concurrent
registrations is not prevented (PR02.05 uses offset semantics).
Node and Chromium dedicated workflow added; exact-head CI pending.

## PR02.06 — Hub-scoped Visibility Projection
Upstream comparison (2026-11-17):
- Theia plugin-ext host/main RPC boundaries:
  https://github.com/eclipse-theia/theia/blob/master/doc/Plugin-API.md
- VS Code extension capabilities/restrictions:
  https://code.visualstudio.com/api/extension-capabilities/overview
Both favor a host-controlled API boundary instead of arbitrary access
to editor internals. ClusterOpt2 retains its existing HubUnit rather
than adding a second plugin host or caller permission database.

New CatalogVisibilityPolicy is an immutable global Property once
registered by LinkCore, with source-scoped AuthorizedCatalogCollection.
HubUnit.discoverCatalog verifies a registered caller without invoking
lazy factories; it computes authorization with existing AccessPolicy,
actual OCDA UserAPI/AgentAPI and EDPMU visibility/owners. A Property
also requires readable=true. Filtering occurs BEFORE search, counts,
pagination or describe; invisible and absent descriptors both produce
404 on describe. No live property values, handlers, files or runtime
permission grants leak. Unknown caller 404, malformed command/context
400; these are observed through OMU EHU. No public Cluster.api yet.

Runtime: one bounded snapshot O(entries + descriptors) per request;
no extra persistent indexes, write locks or async scheduler. Existing
Request, editor, save, and recovery routes remain unchanged. Tests:
Node catalog-visibility.test.js and real Chromium counterpart plus
full OCDA / Windows exact-head checks. Status: CI pending.

PR02.04 exact-head 79c56332: four workflows success. Rollback
backup/plugin-pr02-sub04-79c5633.
PR02.05 CI status must be verified separately before PASS.

## PR02.06 CI failure analysis / compatibility repair
Initial exact-head f4d4b13 dedicated CI FAILED (Node + Chromium),
caused by CatalogCollection calling strict URU.describeAPI on legacy
Objects that have no APIDescriptors. They are valid runtime senders but
not catalog providers. Fixed: skip absent APIDescriptors, preserve
legacy Object runtime and do not synthesize undocumented metadata.
New regression test verifies registered legacy caller, empty read-only
projection and Hub-mediated discovery 200. Re-test full exact-head CI.

## PR02.07 — API Version Compatibility and Deprecation
Compared VS Code extension engines.vscode/version matching and API
proposal lifecycle at https://github.com/microsoft/vscode-docs and
https://github.com/microsoft/vscode/wiki/Extension-API-process .
Design improvement: separate metadata compatibility from runtime
permission and from plugin activation. CatalogVersionPolicy validates
MAJOR.MINOR.PATCH using safe integers; stable major compatibility
requires provider >= requested version with same major; pre-1.0
requires same major and minor (conservative unstable API behavior).
Optional since cannot exceed descriptor version; older-than-since
requests are incompatible. deprecated=true is descriptive; no hidden
side effects, force migration, access revocation or silent automatic
updates. Invalid version/since rejects Object registration with EHU 400.
Policy is a single independent immutable global Property, registered
through HubUnit, but remains pure and cannot grant access. Descriptor
remains detached/frozen. Complexity O(version length), constant bounded
memory. Node and Chromium real integration tests added to CI.
Status: implemented, exact-head CI pending.

## PR02.08 — JSON/Markdown API Docs (GitHub architecture comparison)
Reviewed [AsyncAPI Generator](https://github.com/asyncapi/generator),
[AsyncAPI Markdown template](https://github.com/asyncapi/markdown-template),
and [VS Code extension API guidelines](https://github.com/Microsoft/vscode/wiki/Extension-API-guidelines).
Reuse the machine-readable authorized Catalog descriptor projection instead
of maintaining parallel documentation templates, schema registries or a
third-party templating engine. Pure CatalogDocumentation generates JSON
(schemaVersion 1) and Markdown from HubUnit-scoped discover calls.
It filters source permissions BEFORE serialization, uses pagination of
100, caps data at 4096 entries and UTF-8 output at 64 KiB (413 on
oversize), and escapes Markdown/HTML-bearing metadata. No links to
untrusted files, browser DOM insertion, disk writes, or plugin execution.
The policy is a separate immutable shared LinkCore Property. Code is
O(visible metadata + serialized text length), bounded by the policy
and CatalogQuery; repeated paged collection is acceptable for this
read-only small output. Generation may see dynamic catalog updates
between pages, but each page is independently authorization-filtered.
Live browser facade remains unavailable until PR02.10.
Tests: Node injection/privacy/limit and real Chromium legacy compatibility.
CI: exact-head dedicated catalog, OCDA, PR1, Windows pending.

## PR02.06/07 CI failure diagnosis — follow-up
At exact-head 95230b9, 3 workflows failed: browser jobs were PASS,
Windows passed, while Node catalog-visibility test rejected the AgentAPI
case. Source of error was a test calling discover(source, "list", "api",
{origin:"agent"}) rather than placing origin in the fifth options
argument; CatalogQuery correctly rejected unknown selector fields.
Updated the test to use selector={} and options={origin:"agent"}.
The invalid-origin case now also targets actual HubUnit validation.
Re-run all exact-head jobs before marking PR02.06/07 PASS.

## PR02.09 — Hub EHU negative-path VTE audit
Upstream review: Theia plugin-ext (main/ext RPC isolation) and VS Code
extension-host testing (real integration, not mock-only) reinforce a single
host-controlled boundary. No new permissions or second logging registry.
Catalog describe intentionally maps invisible and missing entries to 404
instead of 403 to prevent existence disclosure. A protected real Request
produces 403 through existing HubUnit AccessPolicy. Ambiguity is 409;
bad selectors 400; oversized documentation 413. Failed documentation
rendering now records EHU at the trusted LinkCore boundary; the pure
CatalogDocumentation Property remains side-effect-free.
Complexity: O(1) per failure log, existing 2000-event bounded OMU history.
Tests: detached real LinkCore VTE, Node and Chromium; exact-head CI gate.

## PR02.10 — Public read-only Cluster.api acceptance
Upstream design review: VS Code Extension API process and its published
capabilities separate a stable surface from internal hosts; Monaco's
public monaco.d.ts is explicitly separated from unstable implementation.
References:
- https://github.com/Microsoft/vscode/wiki/Extension-API-process
- https://code.visualstudio.com/api/extension-capabilities/overview
- https://github.com/microsoft/monaco-editor

Improvement: keep browser API deliberately smaller than trusted LinkCore.
ClusterAPIFacade exposes only list/describe/query/docs, delegates through
LinkCore.discover / HubUnit.discoverCatalog, and fixes source=ui,
origin=user at the trusted binding. Never accept caller-supplied identity,
internal Hub handles, raw Property values, execute/mutate operations or
plugin registration. The existing frozen Cluster facade is extended
without changing legacy methods. A call before UI registration fails 404.
Tests include Node VTE/negative checks and real Chromium, plus exact-head
CI and rollback checkpoint. Runtime version stays 0.0.9-pr9.patch9.
