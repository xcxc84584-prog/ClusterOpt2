# PR13 ArcD — Hub-native plugin architecture

## Principle
**Static contracts and permission rules; dynamic implementation registration.**

```text
User file picker (13.2)
       |
       v
PluginPackageManifestPolicy (13.1; data-only)
       |
       v
Host install coordinator (13.2; not a registry)
       |
       v
HubUnit --> URU (single volatile Object/Provider authority)
   |  \--> EDPMU (single shared Property authority)
   |  \--> OMU (EHU / Log / Dependency)
   |
   +--> permission policy (13.4) --> Worker RPC bridge (13.3)
                                            |
                                            v
                                       plugin code
```

## New property
PluginPackageManifestPolicy — immutable data-only package schema
validator, globally readable through existing LinkCore Property.Read.
It is not a separate permission or registration authority.

## Future Object ownership
HostPluginInstaller owns local picker / package lifecycle. WorkerBridge
owns worker lifecycle and RPC envelope; neither may directly mutate URU.
Their actions pass via HubUnit. Package storage in IndexedDB is separate
from URU: persisted package bytes are not active runtime registrations.
Reload must revalidate and re-register.

## Event chain
PR13.1: user-selected JSON -> parse -> provider contract validator ->
PASS/FAIL, no registration. VTE Property.Read records OMU Log.
PR13.2+: install -> validate -> user approval -> Hub register Object ->
URU register Provider -> RPC execution. Each failure rolls back and logs EHU.
Request/Response envelope stays HubUnit-owned.

## Relation gates
Default 00; no plugin relations until explicit permissions are granted.
Object API declares the available actions; Properties implement algorithms.
No direct plugin access to Cluster internal instances.

## EHU matrix
| Case | Status | Outcome |
| --- | --- | --- |
| Valid manifest | 200 | Return frozen metadata; no side effects |
| Invalid JSON/unknown field | 400 | Reject before registration |
| Unsafe entry/host execution | 400 | Reject before execution |
| Contract schema mismatch | 400 | Reject before registration |
| Install permission denied (13.4) | 403 | EHU, no grant |
| Missing dependency (13.6) | 409 | EHU, rollback |
| Worker timeout (13.5) | 504 | EHU, terminate |

Notes: PR13.1 validator itself is pure; only the routed Property.Read
emits OMU Log. Reject events emitted by future install coordinator.

## PR13 Patch(+2) EventChain and isolation boundary
```text
User gesture -> DirectoryPicker -> PluginLocalPackageUnit
  -> PluginPackageManifestPolicy -> ProviderManifestPolicy
  -> bounded entry read -> staged (no URU mutation)

RPC data -> PluginMessagePolicy -> PluginRPCContractPolicy
  -> service/action check -> validated envelope (no transport)

Declared capability -> PluginPermissionPolicy
  -> PluginCapabilityReviewPolicy -> approved/denied intent
  -> future Hub authorization gate (not yet granted)
```

No new runtime registration authority. LocalPackageUnit reports Log/EHU
to OMU, while immutable policies are read through existing Hub/EDPMU.
Pending security: sandboxed origin, enforceable message-channel source,
origin checks, launch/termination, permission enforcement per invocation,
explicit human approval and route integration.

## PR13 Patch(+3) data and execution separation
```text
Selected project folder (HTML/CSS/JS/images/...)
    -> PluginFolderPackageUnit (bounded traversal)
    -> PluginFolderPackagePolicy (relative path + size + Manifest)
    -> PluginPackageStoreUnit (IndexedDB inert bytes)
    -> Resources export/import (portable JSON snapshot)
    -> future approved activation -> HubUnit -> URU
```

**Security architecture reference:** sandboxed iframe with scripts but
without allow-same-origin, plus restrictive CSP and authenticated message
channel. Never combine same-origin + scripts; never import user-selected JS
into the main page. Network, external URLs and iframe navigation require
explicit risk review. Sandbox JS remains untrusted until PR13.3 passes.

EventChain / EHU: Folder Snapshot 200 / 400 / 413; Package Persist
201 / 503; Bundle Import validation 200 / 400; no runtime relation edges
created by staging alone. Browser adversarial tests and restore flow
remain required before declaring PR13.8 accepted.

A package can declare an optional `uiEntry` HTML page. Bundle validation
requires the UI entry file to exist; it remains inert until approved
sandbox iframe support exists. Host UI does not import its scripts.

## PR13 Patch(+4) API and reload data flow
```text
Plugin API List (UI source "ui")
  -> LinkCore.discover -> HubUnit.discoverCatalog
  -> AuthorizedCatalogCollection -> URU / EDPMU
  -> Request payload schema + Response value schema
  -> LinkCore.listProviderContracts -> HubUnit
  -> URU live Provider Manifest (not cached)

Reviewed module (built into ClusterOpt2) <-> IndexedDB reviewed state
  -> reviewed allowlist -> trusted bundled import -> Hub register
User-authored full-folder bundle -> IndexedDB packages (inert)
  -> awaiting sandbox, approval, per-call Hub ACL
```

Both flows preserve URU as the sole active Provider source.
Restored state never constitutes an untrusted plugin grant.

## PR13 Patch(+5) protocol metadata and template pipeline
```text
HubUnit existing methods -> HubProtocolPolicy (immutable metadata)
  -> EDPMU shared Property -> HubUnit Property.Read(source="ui")
  -> API List (Protocol, Request input and Response envelope)

Current UI Language (zh-Hant/en) -> Template Generator
  -> ZIP (plugin.json, README, HTML/CSS/JS)
  -> user extracts and edits folder
  -> PluginFolderPackagePolicy -> staged bytes (not executed)
```
The protocol metadata is deliberately separate from runtime grants or
execution. No duplicate URU/Provider registry or editable static ACLs.

HubUnit.listActionContracts uses AccessPolicy + URU Object ocda.UserAPI
as its sole source; the API List projects only permitted actions and
marks undocumented schemas absent. No parallel catalog or authority.

## PR13 Patch(+6) executable sandbox EventChain
```text
Native selected folder -> PluginLocalPackageUnit.snapshot
  -> manifest + path validator -> host consent + capability review
  -> PluginSandboxBridge (sandbox iframe, opaque origin, CSP)
  -> MessageChannel private port -> self-contained module exported Action
  -> PluginHostInstallUnit -> HubUnit.register(Object)
  -> HubUnit.registerProvider -> URU Provider Contract
  -> runtime grant through PluginPermissionUnit

Caller -> HubUnit.request(source, pluginObject, action, payload)
  -> Object.receive(action,payload,{source})
  -> HubUnit.invokeExternalPlugin(source, providerId, action, ...)
  -> URU provider / ACL / permission check -> sandbox RPC
  -> validated Response -> HubUnit Response / OMU Log or EHU
```

No untrusted JavaScript loads into host main window; no parallel
plugin registration authority. Runtime bridge handles only source
execution and message deadlines. Relative module imports and HTML UI
sandbox activation are pending, not silently executed by this patch.

### Patch(+6) runtime schema checks
HubUnit before send: RouteContractPolicy.validate(payload, inputSchema).
HubUnit after reply: RouteContractPolicy.validate(value, outputSchema).
Malformed Request 400 EHU, malformed Response 502 EHU; neither bypasses
current Provider/permission checks.

## PR13 Patch(+7) lifecycle EventChain
```text
Host lifecycle action -> URU live dependency graph projection
  -> 409 EHU (active dependent) OR HubUnit disable/unregister
Upgrade -> validate+consent+current grants -> HubUnit disable/removal
  -> new sandbox install -> HubUnit/URU register
  -> success: terminate old bridge
  -> failure: restore previous Object/Provider + previous active grants
```
No parallel registry is introduced. OMU records EHU and Log.
The cutover is not zero-downtime; adversarial browser tests pending.

## PR13 Patch(+8) — dependency and persistence EventChain
```text
Upgrade -> URU dependents projection -> 409 EHU or replacement
  -> confirmed install -> IndexedDB package save
Uninstall -> URU unregister -> sandbox terminate
  -> IndexedDB package delete
Sandbox script -> CSP connect-src 'none' -> failed network fetch
  -> cross-origin parent storage access denied
```
No additional registration authority. IndexedDB stores inert bytes,
not active Providers or permission grants.

## PR13 Patch(+11) release integration (bounded)
```text
Verified PR13.1–13.6 subset -> ReleaseVersion.product=0.0.15
  -> package.json version parity -> npm/VTE/Chromium -> GitHub checks
  -> verified backup -> guarded PR #58 merge -> main
Deferred multi-file UI/import/auto-resume -> future implementation
```
This release gate does not authorize executing arbitrary archived HTML,
relative JavaScript modules or auto-replaying stored capability grants.

## PR13 Patch(+13) — UI refresh EventChain
```text
Tool view update -> PluginManager.refresh -> compare local render state
  -> unchanged: preserve DOM (scroll/focus/search)
  -> changed: render from live URU/HUB, no duplicate registration
User input -> catalogue filter -> ordinary plugin/template cards
Template click -> bilingual ZIP generator -> download only
```
No new EHU status, HubUnit API, Property or Provider. Downloading a
development scaffold never invokes install, URU or capability approval.

## PR13 Patch(+14) — purely presentational layout graph
```text
Resource pane (independent vertical scroll)
  -> heading -> search -> local chooser -> plugin cards
API pane -> search -> table-wrap (x/y scrolling)
  -> min-width table -> readable Kind/Action/Owner/Req/Rep cells
```
No new EDPMU Property, HubUnit service, Provider, permission, EHU
or cross-object dependency. Native browser autofill popup is outside
application styling authority.
