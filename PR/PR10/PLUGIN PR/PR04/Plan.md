# PLUGIN PR04 — Plan

## PR04.01 — Service Request Resolver
Input: registered source, canonical Service ID, action, payload, options.
Output: unmodified HubUnit.request result. Invalid selector => 400;
missing or disabled Service/action => 404; multiple candidates => 409.

## Reviewed GitHub upstream
- VS Code extension commands and language-id contribution contracts:
  https://github.com/microsoft/vscode-docs/blob/main/api/references/contribution-points.md
- Eclipse Theia architecture (frontend/backend and injection):
  https://github.com/eclipse-theia/theia-website/blob/master/src/docs/architecture.md
- Monaco language grammars and tokenizer separation (future PR10):
  https://github.com/microsoft/monaco-editor

## Improvement
Resolve only from the URU-owned Provider index, projected by the existing
ServiceRegistry. Never select by registration order if ambiguous.
Use existing HubUnit.request for all authorization, origin-scoped
UserAPI/AgentAPI, scheduler, EHU/Log and Dependency. New logical route
entry does NOT grant additional authority or invoke Provider factories.
Legacy source/target/action requests remain fully functional.

## Complexity, security and operations
The resolver scans active candidates for one Service, with Provider
actions capped by PR03 limits. No persistent index, new shared Property,
new DOM controls, new file access or uncontrolled parallel execution.
No outside Object receives an untrusted source identity.

## CI / release
Reuse existing CI with per-PR concurrency supersession; the Node and
Chromium test files enter existing standard suites. No duplicate PR04
workflow is necessary at this stage. Five latest-head workflows must
PASS before PR04.01 acceptance. No release version changes while Draft.

## PR04.02 — Bounded declarative Route Table
Schema version 1 accepts at most 32 routes and 32 KiB of data.
Each route declares routeId, service/action, mode, ordered provider IDs,
sourceFilter origins/objects, integer priority (-100..100), and timeoutMs
(1..30000). Replace requires exactly one provider; other modes allow up
to eight, with execution deferred to PR04.03–07. Reject duplicate IDs,
selector/priority collisions, sparse arrays, functions, accessors,
non-plain prototypes, cycles and unknown fields. Return detached deeply
frozen data; never register or activate it in this PR.

References: VS Code manifest contribution points and Eclipse Theia
plugin host dependency injection. Explicit contribution metadata improves
composability without granting permissions by declaration alone.
Complexity O(bytes + routes * providers); no persistent changes, DOM,
network, additional workflow or separate service registry.

## PR04.03 — Replace route
Architecture: resolve declarative Route Table to ONE active provider per
Service/action for a registered caller and explicit request origin.
The trusted host configures a complete schema-validated snapshot through
LinkCore.configureReplaceRoutes(); the browser Cluster.api never receives
this method. Full external route ACL is reserved for PR04.08.

Design study: VS Code's extensionsRegistry.ts uses declarative
contributions with explicit extension activation boundaries; ClusterOpt2
keeps runtime Provider identity in URU and dispatch in HubUnit, unlike
a second plugin-owned dispatcher. Theia's plugin architecture motivates
service identification distinct from provider implementation.

Before commit, validate ALL referenced providers, service/action and
live Object IDs, then publish a single immutable snapshot. A selected
provider becoming disabled/unregistered produces 404, NOT fallback.
No implicit provider creation, separate registry, remote worker, or
physical File System Access is introduced.

Complexity: O(R * P) at configuration (R<=32, P from URU), O(R+P)
per request. Keep EHU for failed config/dispatch; request lineage,
scheduler and authorization stay with existing HubUnit.request().
Priority picks the highest matching declaration; origin/object filters
are exact, origin never inferred. timeoutMs is metadata only until
bounded execution support in PR04.04–05.

## PR04.04 Chain and PR04.05 Fan-out
Reviewed VS Code extensionsRegistry contribution contract and existing
ClusterOpt2 ProviderCompatibilityPolicy/HubUnit scheduler. Route execution
remains centralized; no plugin-specific runner. Chain passes the checked
output to the next stage after structural schema validation, with
adjacent schema equality verified before route activation. Fan-out uses
Promise.all over existing HubUnit.request slots and deterministic
declaration-order aggregation. Any branch failure fails closed without
returning partial data. Provider limits are eight, the scheduler remains
the concurrency authority, and runtime output is bounded to 1 MiB per
stage. timeoutMs remains metadata (no pretense of hard cancellation
for running receive calls). No new browser or agent mutation API.

## PR04.06 — Observe route
Primary Provider receives the original payload; observers receive only a
fixed immutable primitive-only envelope (service, action, status, ok),
never request body, response value, source identity or options. Execute
observer after successful primary completion via guarded HubUnit.request;
observer errors log EHU and do not alter the primary return. No separate
registry/Worker/permission grant or hard timeout. Provider list is bounded
to 8, with one primary and at least one observer. Approximate dispatch
cost is O(number of observers); primary path does not await observer I/O.
Upstream comparison: OpenTelemetry's separation of telemetry export from
business results and VS Code's contribution-based provider boundaries.

## PR04.07 — Response Pipeline (bounded response-value processing)
Reference: OpenTelemetry collector processor pipeline and VS Code
contribution/Provider routing. Keep HubUnit as the single ingress and
response authority: optional responsePipeline field extends the v1 route
schema without changing older valid tables. At most four stages, each
{kind: validate|transform|aggregate, providerId}; no functions or direct
status/event/source/receiver mutation. Aggregate is fanout-only and first;
validate returns boolean true to continue or 422 to reject; transform
returns a schema-checked replacement value. Resolver checks live URU
identity on every call. Activate only when every processor contract is
compatible at configuration; otherwise reject the entire route table.
All stages dispatch through HubUnit.request with original caller/origin,
ACL, scheduler and OMU EHU/Log/Dependency. Intermediate values are
bounded (1 MiB per stage) and copied/frozen before dispatch to prevent
accidental prior-value mutation. Failed primary bypasses pipeline; stage
403/404/422/502 fails closed, without exposing partial outputs. Envelope
metadata is produced solely by core. Time: O(stages * payload bytes),
space: O(max stage bytes), max four sequential stages. No extra runtime,
EDPMU authority, UI privilege, new CI workflow or release bump.

## PR04.08 — Restricted Route ACL and dependency graph
Study: VS Code registry's internal contribution ownership and Theia
command permission segregation. Separate trusted host entry from
runtime caller requests; do not expose a string-based source impersonation
API to browser Cluster.api. New configureOwnedRoutes(source, table) is
host-only, with host-verified source. Require a registered route owner,
exact [source] filter, ownership of all primary and pipeline Providers.
Merge owned routes into the immutable table without erasing other owners.
Whole-table schema, contracts and dependency DAG are checked before swap.
Conservatively reject static cycles across chain/response-stage edges as
409; existing HubUnit.request continues runtime wait-loop detection 423.
Cost: O(route count + providers + edges) bounded by existing 32 routes,
8 primary and 4 response stages. No persistent grants, new API exposed
to third-party plugins, new CI workflow or version bump.
