# PR24.01/02 — Initial outward interface and trust boundary audit

Status: PARTIAL / source-verified inventory, not an exhaustive API dump.
Snapshot: main at PR24 branch point, after PR23 #79 merged.

| Surface | Actual source | Known external operation | Gate |
| --- | --- | --- | --- |
| Host catalog | Implementation/LinkCore/ClusterAPIFacade.js | list, describe, query, docs | Browser 'ui' caller, HubUnit discover audit |
| Service discovery | Implementation/LinkCore/ServiceRegistry.js | list, resolve, candidates, negotiate | URU-owned provider registry |
| Host RPC | Implementation/LinkCore/PluginSandboxBridge.js | start, invoke, terminate | Isolated iframe/Worker and MessagePort |
| Plugin permission | Implementation/LinkCore/PluginPermissionUnit.js | grant, revoke, allows, forget | Manifest, registry, user approval |
| UI content | Implementation/LinkCore/PluginUIHostUnit.js | mount isolated iframe | Host DOM-owned adapter |
| UI control | PR23 UICO and UISP sources | bounded UI state/actions | HubUnit, capability, owner ACL |
| Property authority | EntireDomainPropertyManagementUnit.js | shared definitions | EDPMU |
| Registration | UnifiedRegistrationUnit.js | runtime dynamic registration | URU |
| Event audit | ObjectManagementUnit.js | Log and EHU | OMU |

## Boundary crossings
1. Host parent -> opaque iframe: bootstrap message and transferred port.
2. Opaque iframe -> dedicated Worker: module source and inner port.
3. Worker -> iframe -> trusted host: structured messages relayed;
   source fields inside the payload are never sufficient evidence.
4. Plugin UI iframe -> host UI adapter: host-owned delegated actions.
5. Host -> HubUnit -> URU/EDPMU/Object: authoritative routing.
6. Host -> OMU: auditable failures, successes and dependencies.

## Observed security strengths and limitations
- PluginSandboxBridge iframe uses sandbox=allow-scripts without
  allow-same-origin; CSP blocks direct network connections.
- Existing Worker runtime dispatches host 'invoke' and emits 'response',
  but does not yet implement generic reverse Plugin -> Host RPC.
- Existing RPC contract uses numeric id and does not contain the
  full PR24 event chain or Session protocol.
- PluginPermissionUnit maintains runtime grants, but new reverse calls
  must re-check grants at each dispatch; a grant snapshot is unsafe.
- PluginUIHostUnit has host-owned UI mounts and plugin-specific
  branches, which is not proof of a fully generic external UI SDK.
- The new PR24 envelope validator is data-only; it does not install
  or authenticate channels.

## Required next audit evidence
Enumerate exact HubUnit registered API descriptors, URU service
actions, UICO native UI IDs, all Worker message kinds and the
Plugin Manager exposed routes. Compare the runtime API catalog to
source-level registrations and document every uncovered route.
Mark each as Public / Protected / Private, caller type, permission,
input and output schema, error codes, version and bounded payload.
No unknown route may be presumed supported.

## Host-specific callout
The prior PluginSandboxBridge uses an embedded bootstrap source.
PR24 should move transport behavior to an isolated adapter, not add
more ad-hoc dynamic branches to the existing UI host. Keep the older
interface working until the replacement passes E2E.
