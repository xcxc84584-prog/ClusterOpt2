# ClusterOpt2 Worker Plugin SDK (cluster.rpc/1)

This is a **Host-supplied ambient SDK**, not a Host-internal import.
A third-party folder plugin uses `Cluster` inside `worker.js`.
Host-owned code binds the Worker to its `plugin.json` Provider
identity, an isolated MessagePort and explicitly approved `rpcScopes`.

## Authoring

1. Copy `examples/echo` or `examples/delegate` as a separate folder.
2. Set a unique `provider.providerId` and `objectId`, a `provides`
   action with input/output schemas, and `entry: "worker.js"`.
3. Register declared actions with `Cluster.handle("echo", callback)`,
   or continue using the legacy named `export function echo(...)` form.
   You cannot add executable actions not declared in the manifest.
4. To invoke other Objects, declare **exact** `rpcScopes` with
   `{target:"ObjectId",action:"action"}`. No wildcard permission.
   Requests are separately confirmed at install/upgrade, and are
   rechecked by HubUnit at dispatch.
5. On reload, scope revocations in IndexedDB remain denied. A
   `plugin.json` or `approvedRpcScopes` field cannot self-grant.
6. Use `Cluster.request(target, action, payload, {deadlineMs, signal})`
   or its alias `Cluster.service(...)`. Failed requests reject with a
   `PluginRPCError` carrying `code` and HTTP-like `status`.
7. `Cluster.onSessionChange(cb)` emits `ready` and `suspended`.
   Returned unsubscribe functions remove listeners.
8. The global SDK is version `1.0.0`; ambient TypeScript typings
   are in `cluster-plugin-sdk.d.ts`.

## Limits and safety

- Only source modules bundled in the selected local folder execute.
  No network, main-page DOM or file system access is provided.
- Worker exports/handlers are invoked through Host/Bridge/HubUnit, not
  dynamically registered as URU providers by the plugin.
- Provider permissions and RPC scopes must pass Host review, URU,
  object ACL, and (for Property.Read) EDPMU's visibility check.
- Requests use the `cluster.rpc/1` protocol, bounded payloads and
  deadline (1–30000 ms). Live Host cancellation is best effort.
- Revoked scopes are **deny-only**: there is no automatic regrant.
- Not all planned APIs (generic UICO window mutation, scope regrant,
  cross-tab sync, resource quotas) are released by this SDK version.

## CI / actual third-party example

`Implementation/e2e/pr24-sdk-third-party.spec.js` loads the
unmodified example folders using browser fetch, installs them using
the normal Host installer and asserts end-to-end Plugin A -> HubUnit
-> Plugin B calls, unauthorized route denial, session identity and
uninstall cleanup. No first-party plugin-specific registration is added.


## Native host UI components through the public SDK

`examples/native-ui` is a standalone folder plugin that creates an
actual Host-owned toolbar Button and tabbed settings Window **without
editing ClusterOpt2 code**. It declares:

- `rpcScopes: [{target:"UICO",action:"uiRequest"}]`
- Host-reviewed `permissions: ["ui.read", "ui.create.own",
  "ui.update.own", "ui.window"]`

The plugin calls `Cluster.request("UICO", "uiRequest", envelope)`
with `protocol:"cluster.ui/1"`, `targetId:"UICO"`, and action
`UI.Create`, `UI.OpenWindow` or `UI.AddTab`. UICO resolves the
authenticated Worker Object ID from HubUnit, confirms the live
Provider permission and creates only owner-scoped DOM nodes.
Native Host UI cannot be overwritten. Uninstall removes owned nodes.

Browser conformance: `pr24-sdk-third-party.spec.js` checks the
real Button click → Worker handler, settings Window with two
native tabs, access denial, and automatic owner teardown.
