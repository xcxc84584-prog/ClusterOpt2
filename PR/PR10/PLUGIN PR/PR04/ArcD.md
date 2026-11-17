# PLUGIN PR04 — ArcD

## Object/Property table
| Component | Kind | Role | Owner |
| --- | --- | --- | --- |
| ServiceRequestResolver | LinkCore helper | read-only resolver | LinkCore |
| ServiceRegistry | existing projection | available Providers | URU |
| URU | existing registry | Object/Provider authority | LinkCore |
| HubUnit | existing gateway | REQ/REP/ACL/schedule | LinkCore |
| OMU | existing observer | EHU/Log/Dependency | LinkCore |
| EDPMU | existing registry | shared Properties | LinkCore |

No new shared Property or separately registered Object is introduced.

```mermaid
flowchart TD
  Caller[Registered caller] --> Hub[HubUnit.requestService]
  Hub --> Resolver[ServiceRequestResolver]
  Resolver --> Registry[ServiceRegistry]
  Registry --> URU[URU Provider index]
  Resolver -->|single candidate| Existing[HubUnit.request]
  Existing --> Policy[AccessPolicy and User/Agent API]
  Policy --> Scheduler[ExecutionScheduler]
  Scheduler --> Target[Existing Object.receive]
  Resolver -->|400/404/409| OMU[OMU EHU/Log]
  Existing --> OMU
  Target --> OMU
```

## EventChain
1. Verify registered source (404 / EHU otherwise).
2. Validate canonical Service ID/action (400), query active Providers.
3. Resolve none 404, multiple 409; EHU and no dispatch.
4. Resolve exactly one Object/action; log selected Provider.
5. Delegate to HubUnit.request with original source/options/payload.
6. Existing Hub checks UserAPI/AgentAPI and AccessPolicy, schedules
   dispatch, logs Request and Response; failure remains EHU.
7. OMU records Caller->Target=10, Target->Caller=01 when successful.

## Route invariants
No silent Provider choice, no implicit factory execution, no
authorization or origin bypass, no change to legacy target-ID semantics.
Full route generation / atomic replacement are future PR04/PR05 tasks.

## PR04.02 — RouteTablePolicy
New independent property policy module:
`Implementation/property/RouteTablePolicy.js` (NOT EDPMU-registered).
Input: untrusted declarative data. Output: 400 or immutable canonical
Route Table snapshot. It never writes HubUnit, URU or EDPMU.

```mermaid
flowchart LR
  Manifest[Route Table data] --> Policy[RouteTablePolicy.validate]
  Policy -->|200| Frozen[Immutable snapshot only]
  Policy -->|400| Reject[Reject without side effects]
  Frozen -. future PR04.03 .-> Hub[HubUnit routing]
  Hub --> URU[URU providers]
```

EventChain: local validation only; no Request or Response dispatch, no
new Dependency edge, no EHU mutation. Future callers must use HubUnit
for route operations, permission checking and EHU/Log; this pure policy
cannot authorize its own input. Relation Code 00 for validation itself.

## PR04.03 — Replace routing
Object/Property: no new Object or EDPMU Property. ServiceRequestResolver
reads an immutable HubUnit-owned RouteTablePolicy snapshot; URU is the
single live Provider authority. HubUnit retains all Request/Response,
AccessPolicy, User/Agent API checks and OMU records.

```mermaid
flowchart TD
  Host[Trusted host config] --> Check[RouteTablePolicy]
  Check --> Live[URU live Provider validation]
  Live -->|all valid| Snapshot[Immutable route snapshot]
  Caller[Registered caller + origin] --> Resolver[ServiceRequestResolver]
  Snapshot --> Resolver
  Resolver -->|one selected provider| Hub[HubUnit.request]
  Hub --> ACL[UserAPI AgentAPI and AccessPolicy]
  ACL --> Target[Registered Object.receive]
  Resolver -->|404 or 409| EHU[OMU EHU]
  Hub --> EHU
```

Event Chain:
1. Host configuration validates RouteTablePolicy; rejects 400/404
   without mutation, records EHU. On success swaps one snapshot.
2. Incoming REQ checks caller existence and explicit origin.
3. Matching replace routes filtered by Service/action/origin/caller.
4. Highest priority resolves live URU Provider. A disabled or missing
   selected Provider returns 404; no silent reassignment.
5. Existing HubUnit.request enforces ACL, scheduler, EHU/Log and REP.
6. Dependencies are still Request=10 and Response=01 on success.
No new Event ID allocator or independent route authority.

Separate future PR05 routeVersion/CAS/draining and PR04.08 external
permission gate; this is a trusted in-process configuration, not a
sandbox boundary or untrusted plugin administration API.

## PR04.04–05 Dataflow and ownership
```mermaid
flowchart TD
  R[HubUnit.requestService] --> S[ServiceRequestResolver]
  S --> U[URU live Provider index]
  S --> M{Configured mode}
  M -->|chain| C[Sequential contract gates]
  M -->|fanout| F[Bounded parallel requests]
  C --> H[Existing HubUnit.request]
  F --> H
  H --> ACL[UserAPI AgentAPI AccessPolicy]
  H --> OMU[EHU Log Dependency]
  C --> V[Validated final output]
  F --> A[Ordered all-or-nothing results]
```

No new Object registry or shared EDPMU Property. RouteContractPolicy
is pure and local to LinkCore. Each hop is a full request+response;
the registered original caller remains the source, never an arbitrary
Provider-supplied identity. Chain validates per-hop input/output; fanout
checks each input before dispatch and each output after results.
Failures 422/502 record EHU; ACL failures retain original 403.
The scheduler is unchanged, so concurrency is asynchronous only.

## PR04.06 — Observe sidecar architecture
```mermaid
flowchart TD
  R[Service Request] --> S[ServiceRequestResolver]
  S --> P[Primary via HubUnit.request]
  P --> V[Validate primary output]
  V --> Rep[Return original response]
  V --> M[Minimal immutable event]
  M --> O[Observer via HubUnit.request]
  O --> E[Observer EHU on failure]
```
Observe requires at least two Providers (primary then sidecars). A failed
primary is returned unchanged with no observer invocation. Sidecars can
never receive original payload/response; each one still faces the original
ACL/UserAPI/AgentAPI checks. Observer failures do not affect REP. OMU
records the same normal 10/01 dependency edges for successful calls and
EHU for rejected observation.

## PR04.07 — Response Pipeline ArcD
```mermaid
flowchart TD
  Source[Caller + origin] --> Resolver[ServiceRequestResolver]
  Resolver --> Primary[Primary chain fanout observe via HubUnit]
  Primary -->|success value| Gate[Schema validation + detached data]
  Gate --> Stage[Bounded response Provider via HubUnit.request]
  Stage -->|validate true| Gate
  Stage -->|transform or aggregate| Gate
  Gate --> Final[Original Hub REP envelope, final value]
  Stage -->|403 404 422 502| EHU[OMU EHU, fail closed]
```
New pure helper: ResponsePipelinePolicy; no new Object or EDPMU shared
Property. RouteTablePolicy optional descriptor, Resolver resolves URU
Processor manifest; HubUnit enforces contract compatibility at atomic
route install and runtime contracts at each hop. Primary response status,
source and target are never a plugin-controlled payload envelope.
Each pipeline Provider uses original source and origin, its own complete
Hub request/response and 10/01 OMU Dependency edges. Any failure returns
its guarded error or a recorded pipeline EHU, never a partial success.
No Event ID is fabricated or rewritten; OMU remains lineage authority.

## PR04.08 — Route ACL and dependency control
```mermaid
flowchart TD
  Host[Trusted host identity] --> Owner[RouteControlPolicy scoped]
  Owner -->|scope and provider owner pass| Merge[Preserve other owners]
  Merge --> Schema[RouteTablePolicy]
  Schema --> Contracts[Service and Processor contract checks]
  Contracts --> DAG[RouteControlPolicy dependency DFS]
  DAG -->|acyclic| Swap[Immutable Hub route snapshot]
  Owner -->|403 or 404| EHU[OMU EHU]
  DAG -->|409| EHU
```
New pure helper RouteControlPolicy; no new Object or EDPMU Property.
Configuration permission differs from execution permission. Registered
caller identity is established by trusted host, never supplied through
Cluster.api. Each runtime hop keeps HubUnit AccessPolicy, API origin,
scheduler and OMU EHU/Dependency. Cycles are preflight-rejected, nested
runtime cycles still generate 423 through existing wait edges.

## PR04.09–10 Route-read and acceptance architecture
```mermaid
flowchart TD
  UI[Browser Cluster.routes] --> Facade[Fixed ui + user origin]
  Facade --> Query[RouteQueryPolicy]
  Query --> Hub[HubUnit.inspectRoutes]
  Hub --> Owned[Scoped owner-only metadata]
  Hub --> Resolve[ServiceRequestResolver live URU]
  Resolve --> ACL[Stage UserAPI and AccessPolicy]
  ACL --> Preview[Redacted no-execution preview]
  Query --> EHU[OMU read audit and EHU]
  Gate[Node VTE Chromium and exact SHA CI] --> Backup[Verified major restore]
  Backup --> Merge[One PR04 merge to main]
```
No new Object, EDPMU shared Property or second routing authority.
RouteQueryPolicy and RouteReadFacade are pure read-boundary helpers.
Preview has Relation 00: no Request/Response dispatch and no dependency
edge; real routing remains guarded, keeping 10/01 and EHU semantics.
