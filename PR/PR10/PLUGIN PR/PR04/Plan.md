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
