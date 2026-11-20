# PR24 Patch(+10) — Live reverse RPC scope revocation

Date: 2026-11-20. Branch: feature/pr24-bidirectional-plugin-sdk.
GitHub PR #80 remains **Draft**, main not modified.

## Objective
A user must be able to revoke one previously approved reverse RPC route
without disabling the whole plugin, mutating URU's Provider registry,
authorizing arbitrary Host APIs, or restarting the browser.

## Implementation
- PluginHostRequestGateway now owns a host-private immutable active
  scope list. `listRpcScopes` returns a frozen read-only snapshot;
  `revokeRpcScope` validates exact canonical scope and removes only
  one matching entry (invalid 400, unknown/already revoked 404).
- Gateway checks active scopes both before dispatch and after Hub work
  completes. A noncooperative Host response is discarded if the scope
  was revoked while its request was running.
- PluginHostRequestTransport maps live requestId to
  AbortController + target/action/property identity. On Host revoke
  it aborts **only matching** requests and sends a correlated typed
  `cluster.rpc/1` response with status 403,
  `RPC_SCOPE_REVOKED`, requestId and fresh OMU eventId.
- Unrelated calls remain active. An aborted noncooperative Host Object
  keeps its in-flight reservation until it settles; stale success
  cannot be delivered by transport or Gateway.
- PluginSandboxBridge adds Host-only list/revoke delegation.
  PluginHostInstallUnit resolves a registered, managed Provider
  before allowing the Host Manager to revoke its scope.
- Plugin Manager permission pane shows active exact approved scopes and
  exposes confirmation before each **revoke** operation.
  It never presents an in-session grant button.
- A disabled plugin can be re-enabled with a new Session challenge,
  but the revoked scope does not reappear in the same Bridge.
- No new EDPMU global property or duplicate URU registry.

## Test coverage
- Unit: `pr24-rpc-scopes.test.js`: partial/exact revoke,
  double revoke, invalid declarations, remaining Property route,
  late Host completion blocked.
- MessageChannel: `pr24-messageport-integration.test.js`:
  in-flight revoke returns one 403; unrelated route survives;
  late data never posts; 403 for subsequent calls; rekey preserves
  revoked state without MessagePort listener leaks.
- Browser: `pr24-reverse-rpc.spec.js`: real isolated Worker,
  live uninstall/disable/re-enable path, approved route still works,
  revoked route stays denied; EHU/Log verified.
- VTE: `pr24-rpc-scope-vte.test.js` uses a detached LinkCore with
  actual URU Provider registration, HubUnit.readProperty,
  EDPMU visibility and OMU event checks.
- CI: exact HEAD must pass all mandatory workflows before
  calling Patch(+10) accepted. Older cancelled workflow runs
  are never counted as PASS.

## Lint incident / correction
The first Patch(+10) branch check rejected a test fixture with a
`secret` object key as a possible hardcoded credential. Renamed the
fixture field without relaxing any assertions, and kept the lint
policy unchanged.

## Limitations / threat model
- Abort cannot undo an Object's completed external side effects;
  neither atomic transaction rollback nor a Host-wide circuit
  breaker is claimed.
- Active scope revocation persists across disable/re-enable in the
  current Bridge. Durable revocation across browser reload and
  persisted installed bundle review is **not yet implemented**.
- A new plugin install/upgrade requires explicit re-consent to obtain
  new approved routes.
- SDK conformance, pending upgrade rollback, external plugin examples,
  full browser VTE, 100 individual subPR acceptance gates remain.

## Restore / merge policy
PR #80 remains Draft. No merge to main, no production release.
Only merge after exact-HEAD CI, VTE, third-party conformance,
full subPR acceptance, and a recoverable backup.
