# PLUGIN PR03 — Plan.md
## SOP
PRD → Plan → ArcD → Implementation + Relation Test → Project.
Read latest PLUGIN PR02 handoff, global Property registry and pending
issues; preserve LinkCore/HubUnit/URU/EDPMU/OMU authority.

## PR03.01 — Canonical Capability IDs
Upstream GitHub review:
- VS Code extension identifiers and extension-host contract:
  https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensions.ts
- Theia plugin protocol and identifier handling:
  https://github.com/eclipse-theia/theia/blob/master/packages/plugin-ext/src/common/plugin-protocol.ts
- VS Code extension manifest design:
  https://github.com/microsoft/vscode-docs

Improvement: a *single* immutable shared policy defines service identity
independently of Provider identity, version negotiation, permissions,
runtime factories and REQ routes. One service may have many Providers;
do not confuse repeated Provider services with repeated Service IDs.

Grammar: 2–8 dot-separated lowercase ASCII segments. Every segment
starts with a-z, followed by a-z/0-9 or single hyphen-separated tokens;
each <=32 chars; whole ID <=128 characters. No @version suffix:
SemVer belongs in the manifest. No normalization of unsafe mixed-case
identifiers; reject them instead. No arbitrary prototype-like keys.
Pure bounded checkUnique returns 409 for duplicate canonical Service ID
in an explicitly provided *Service ID list*, and never reserves a name.

One Property file CapabilityIdPolicy.js registered once by LinkCore via
HubUnit into EDPMU (Public metadata policy, not permission).
No new Object or registry; no UI change, file write or plugin execution.
O(length) validation, O(n) collision scan with <=4096 entries.
Node detached VTE and Chromium integration plus global regressions.

## Merge safety
Main baseline 5191ffc8d1ae7996526b8808bd535a330c1f6269.
Before merge, all 10 subPR gates must pass at exact head; branch restore
must point to pre-PR03 main and latest PR03 head. No early merge.

## PR03.02 — Provider Manifest v1 (upstream design review)
Reviewed GitHub source:
- VS Code extension metadata/manifest and extension identity:
  https://github.com/microsoft/vscode/blob/main/src/vs/platform/extensions/common/extensions.ts
- Theia plugin host protocol/metadata separation:
  https://github.com/eclipse-theia/theia/blob/master/packages/plugin-ext/src/common/plugin-protocol.ts
- AsyncAPI operation/contract metadata:
  https://github.com/asyncapi/spec/blob/master/spec/asyncapi.md

Design improvement: separate declarative Provider Manifest from the future
authoritative URU registration, ServiceRegistry, routing, and execution
sandbox. A validated manifest is DATA only, never an authorization grant.
Each providerId and service uses PR03.01 canonical ID policy; objectId is
separate URU identity. SemVer uses existing CatalogVersionPolicy.
Manifest v1 declares manifestVersion, providerId, objectId,
provides (service/action/version/inputSchema/outputSchema),
requires, permissions, execution (isolation/concurrency).
No executable handlers or string-based factories allowed.
Strict known keys, max 32 provided services, max 64 requirements and
permissions, max 32 KiB UTF-8, finite JSON plain data, no cycles,
functions, getters, symbol keys or prototype pollution.
Use PR02 APIDescriptorPolicy schema subset for each provided contract.
Reject duplicate service within one Provider and direct self-dependency;
multiple different providers may advertise the same service in PR03.05.
Bounded O(total JSON bytes + N) validation; deeply detached frozen value.
One new Property file, registered once via LinkCore/HubUnit/EDPMU.
No browser-facing registration, no service execution, no Route Table.
Node real VTE, Chromium, OCDA, legacy API and Windows CI gates.

## PR03.03–03.10 implementation plan, risk/load review
**03.03 URU ownership:** URU stores Provider Manifest metadata and the
Provider ID/Service ID secondary indices. Only an existing Object with
matching Manifest objectId and declared Request actions can register.
HubUnit checks registered source identity, reports EHU for 400/403/
404/409. Object unregister removes its linked provider candidates.

**03.04 EDPMU claims:** Manifest may declare <=32 sharedProperties with
access read/write and isolation private/shared. Check EDPMU visibility
and ownership before accepting a Manifest, then require an additional
HubUnit gate for each Provider write. Existing EDPMU remains sole mutable
Property authority; unsafe writes 403 and unchanged existing data.

**03.05 ServiceRegistry:** read-only projection of URU's indexed
Service->Provider mapping (O(candidate count)), 200/400/404; no
provider factory activation, route selection or independent Object
registration. Multiple Providers can advertise a Service.

**03.06 trusted factory:** Factory references are explicitly supplied
by trusted in-process code after owner registration. A factory may
materialize lazily at most once per Provider, and is never invoked during
Service lookup/Catalog read. The closure/instance is not exposed in the
Manifest and no arbitrary remote JS loading is provided (PR06).

**03.07 lifecycle:** disableProvider != disableService !=
disposeProvider != unregisterProvider != unregisterObject. Disabled
candidates stop appearing in service resolution but remain registered;
stopping one Provider leaves others intact. unbindRoute belongs to PR04,
draining and CAS to PR05; do not claim implemented here.

**03.08 compatibility:** conservative exact input/output schema
comparison and PR02 SemVer (1.x same-major; 0.x same-minor).
Nonmatching candidates rejected with 409, without changing current
active routes.

**03.09 health:** immutable healthy/degraded/faulted state, after three
failures 30-second cooldown; URU owns health and candidates exclude
temporarily faulted providers. Core Object registrations remain intact.
OMU EHU on 503/504 failures and 429 blocked reports.

**03.10 integration:** test different registered owners, Public/Private
EDPMU claims, external impersonation, service collisions, restore of
disabled candidate, lazy trusted factory, compatibility, health and
VTE 00/10/01 REQ/REP EventChain. Test actual browser, old Cluster API,
PR02 Catalog, Node, OCDA, PR1 and native Windows.
No full plugin runtime or File I/O integration until later major PRs.

### Release governance integrated alongside PR03
One canonical `ReleaseVersion.product`, mirrored into package.json by
`npm run version:sync`; mandatory CI `npm run version:check`.
LinkCore, EDPMU SystemVersion, Cluster.version and UI version label all
derive from LinkCore's canonical value. Draft PR child patches do not
bump public product versions. Only at full major-PR release gate may
version change, then all exact-head CI must rerun before protected merge.
Restorable main baseline: 5191ffc8d1ae7996526b8808bd535a330c1f6269.
