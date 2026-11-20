# PR24 Patch(+9) — Scoped Object / Action / Property reverse RPC

Date: 2026-11-20. PR #80 remains **Draft**. main is unchanged.

## Objective
An independent plugin cannot invoke arbitrary Public Host routes merely
because the Provider is registered. Reverse RPC must be limited to
exact routes declared by the plugin and explicitly approved by the host
user. Registration metadata never acts as an authorization token.

## Implementation
- Added pure `PluginRPCScopePolicy` for bounded canonical scope entries:
  `{target, action}` for an exact Object action, or
  `{target:"HubUnit", action:"Property.Read", property:"Name"}`.
- No wildcards or prefix matches, no implied sub-object scope, no
  `HubUnit` operation except Property.Read. Maximum 32 exact scopes.
- `PluginPackageManifestPolicy` validates optional package-level
  `rpcScopes`; this is separate from the URU Provider Manifest.
- PluginHostInstallUnit requires host-provided `approvedRpcScopes`
  to match the declared list, and checks the new candidate before
  disabling the existing version during an upgrade.
- PluginSandboxBridge transfers the host-approved immutable scopes to
  the private Gateway. The Worker sees only Cluster.request, not grants.
- Gateway performs Session, live URU, existing PluginPermission and
  exact scope checks before dispatch. Rejections emit `RPC.ScopeRejected`
  EHU with a correlated typed 403 Response.
- A scoped Property.Read calls `HubUnit.readProperty` for its validated
  name, retaining EDPMU visibility authorization. No Property writes
  or direct EDPMU reference is exposed.
- Plugin Manager install and upgrade dialogs display requested RPC
  scopes and pass the approved set after explicit user confirmation.
- Original Host-to-Worker invocation and scope-free plugins remain
  installable. Scope-free Workers have no reverse RPC authority.

## Test coverage added
- `pr24-rpc-scopes.test.js`: hostile scope data, malformed fields,
  duplicates, bounded counts, approvals, exact route matching and
  property isolation; dialog rendering.
- `plugin-sandbox-install.test.js`: unsigned/unapproved routes cannot
  activate the Worker or register an URU Provider.
- `pr24-messageport-integration.test.js` and
  `pr24-host-request-gateway.test.js`: explicit approved fixtures.
- `pr24-reverse-rpc.spec.js`: actual isolated Worker with approved
  UICO.describe scope and scoped SystemVersion Property.Read, with
  rejected unapproved Language Property.Read.

## Security notes
- All scopes are exact-match, host-owned, and inactive until consent.
- Runtime denial does not call the requested Object.
- HubUnit still owns Request dispatch and Object action permissions;
  URU remains Provider authority, EDPMU Properties, OMU EHU/Log.
- A scope permits only reaching Hub authorization; it does not bypass
  existing payload validation or protected/private visibility.
- Fine-grained revocation of one scope within an active Session,
  rehydration consent persistence, cross-plugin conformance and full
  resource quotas require later patches. No 100/100 PR24 acceptance.

## Verification / rollback
- Patch(+9) is committed only to the isolated feature branch.
- Check the **exact final HEAD** GitHub Actions, Playwright browser
  results and VTE before recording PASS; no main merge.
- Previous good reference: Patch(+8) all four workflows passed.
- Next: Patch(+10) add mid-flight scope revoke, upgrade rollback
  while Worker reverse calls are pending, SDK conformance and VTE.
