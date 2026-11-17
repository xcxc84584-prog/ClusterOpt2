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
