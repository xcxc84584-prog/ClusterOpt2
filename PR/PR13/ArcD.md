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
