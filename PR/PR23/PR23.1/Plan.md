# PR23.1 — PluginManagerUnit (PMU) Plan

## Goal
Introduce an additive, host-only PluginManagerUnit without any modification to `Implementation/LinkCore/HubUnit.js`. Provide exactly three plugin-facing message channels: Permission, Request and Response. PMU is an adapter over existing HubUnit, URU, EDPMU, PluginPermissionUnit and PluginUIHostUnit.

## Unit mapping
- **OCU** Object Control Unit: registered Object/Service invocation via existing LinkCore request and requestService, with Hub ACL and origin enforcement.
- **PCU** Property Control Unit: readProperty and Provider-owned shared Property publish only through existing HubUnit policies.
- **UCU** UI Control Unit (disambiguated from the duplicated Chinese label): operate a Provider's *own* already-mounted isolated UI; mount and lifecycle remain under the existing trusted PluginHostInstallUnit / PluginUIHostUnit.

Each unit exposes four responsibilities: registrar (URU projection), bridge (existing callable API), permissions (live capability check) and forwarder (bounded dispatch).

## Three message channels
- Permission: declaration/grant status (not grant by request). Returns 200 granted, 202 host approval required or 403 denied.
- Request: routes OCU / PCU / UCU and returns authorized Hub/Host result. Requests cannot claim caller IDs; identity is bound by trusted host.
- Response: host-registered correlation ID only, same authenticated Provider, one-shot acceptance.

## Scope and constraints
- No HubUnit edits or new registration authority.
- No direct plugin DOM access or unrestricted host CRUD.
- No auto-consent: `grantFromHost` may be called only by trusted host following real UI permission approval.
- UCU v1 reuses **existing UI panels**. Arbitrary Slot creation, replacement and remote UI registration are deferred; claiming full UI-agnostic pluginization at this stage would be inaccurate.
- JS exposed as an internal `core.pluginManagerUnit` handle, NOT added to `window.Cluster`.
- No keys, system paths, or debug guidance on user UI.

## Dependency reuse
`LinkCore` -> PMU -> OCU/PCU/UCU -> `HubUnit` / `PluginHostInstallUnit.uiHost`.
`URU` is the sole Provider/Object owner; `EDPMU` remains the sole Property authority.

## Verification
Node tests: contracts of 3 channels and 4 responsibilities per unit; exact caller binding; undeclared vs approved capability; Object/Service ACL routing; Property ACL/write denial; own UI view only; unexpected/cross-Provider Response rejection; malformed input and removed Provider denial.
Run existing CI and retain a Draft PR until checks pass.

## Next PR
UI Slot Registry + versioned UI Contribution Contract + lifecycle cleanup, and a trusted host adapter wiring the PMU message channel to sandbox RPC, while leaving HubUnit unchanged.
