# ClusterOpt2 API LIST — Third-party Plugin Developer Guide (PR25 draft)

> Read the live registry catalog before using any action. This guide
> does not authorize execution. All calls remain controlled by the Host.

## 1. Catalog authority and visibility

- `Cluster.api.page(kind, {term, owner, limit, cursor})` is the browser
  projection of `HubUnit.discoverCatalog("ui","page",...)`.
- `Cluster.api.describeLive(kind,id,owner)` fetches a complete descriptor
  after authorization; no inferred schema is permitted.
- Kinds: `api` (Object Request), `service`, `property`,
  `event` (explicitly registered URU/EDPMU Event contracts), `protocol`.
- The page returns `items`, `total`, `nextCursor` and
  `snapshotRevision`. A cursor belongs to exactly one query and
  revision. HTTP 409 requires restarting at page one.
- `Host Internal` means the Host may use the method internally; it
  does **not** imply a third-party capability.
- `Plugin Public` requires a declared action, an approved scope,
  available session, and a successful Host ACL check.

The separate Worker SDK has `Cluster.version`, `Cluster.ready`,
`Cluster.request`, `Cluster.service`, `Cluster.handle` and
`Cluster.onSessionChange`. There is no direct Worker access to the
browser catalog UI, Host DOM, local file handles or arbitrary URLs.

## 2. Minimal package

```text
my-plugin/
  plugin.json
  worker.js
  index.html
```

Use the repository's tested, self-contained sample:
`Implementation/sdk/examples/echo/`. Its `plugin.json` is:

```json
{
  "packageVersion": 1,
  "name": "SDK Echo (External)",
  "entry": "worker.js",
  "description": "Independent reverse-RPC provider fixture",
  "provider": {
    "manifestVersion": 1,
    "providerId": "example.sdk.echo",
    "objectId": "SDK.ExampleEcho",
    "provides": [{
      "service": "example.sdk.echo",
      "action": "echo",
      "version": "1.0.0",
      "inputSchema": { "type": "object" },
      "outputSchema": { "type": "object" }
    }],
    "requires": [],
    "permissions": [],
    "execution": { "isolation": "worker", "concurrency": "serial" }
  },
  "uiEntry": "index.html"
}
```

`worker.js`:

```js
Cluster.handle("echo", payload => ({
  echoed: String(payload.message ?? ""),
  sdkVersion: Cluster.version
}));
```

For a reverse Host request, add the **exact** declaration
to the manifest's top-level `rpcScopes`. A declared scope alone is
not permission; the user/Host must approve it. For example:

```json
"rpcScopes": [
  {
    "target": "HubUnit",
    "action": "Property.Read",
    "property": "UI_COLOR"
  }
]
```

```js
await Cluster.ready;
const unsubscribe = Cluster.onSessionChange(state => {
  if (state === "suspended") {
    // Do not schedule new Host requests.
  }
});
try {
  const color = await Cluster.request(
    "HubUnit", "Property.Read", { name: "UI_COLOR" }
  );
  // Use only the returned authorized value.
} catch (error) {
  // RPCError exposes code and status.
  if (error.status === 403) {
    // Request explicit consent; do not retry in a loop.
  }
}
unsubscribe();
```

## 3. Loading, sandbox and CSP

Use Plugin Manager to select the package folder containing
`plugin.json`; the Host snapshots and validates its relative resources.
Review requested permissions and `rpcScopes` before installation.
The package uses an opaque-origin sandbox iframe and a dedicated Worker.
Its bootstrap uses restrictive CSP (no direct network connection,
font/source or parent DOM permission). `uiEntry` is the local HTML
resource, not an unrestricted remote route.

Do not embed secrets, system-specific absolute paths or inline
deployment keys in the package. Workspaces, editor documents,
PowerShell and UI resource modification each require their own
approved capability; a read scope does not authorize writes.

## 4. Request, Response and common denial codes

The Host's Request/Response protocol is represented as:

```json
{
  "ok": true,
  "status": 200,
  "value": { "example": "approved result" }
}
```

A denial or stale state is represented as:

```json
{
  "ok": false,
  "status": 403,
  "error": "RPC_SCOPE_CONSENT_REQUIRED"
}
```

`400`: invalid schema/scope; fix the manifest or payload.
`403`: missing ACL, consent or capability; obtain review or use
an authorized action.
`404`: unregistered identity or unavailable descriptor.
`409`: stale revision, duplicate identity or conflicting state;
discard stale cursor/request and re-read current metadata.
`425`: Session handshake incomplete; use `Cluster.ready`.
`503`: Session/transport unavailable; wait for a valid ready state.
`504`: timeout; cancel or retry only when safe and idempotent.

Check `Implementation/property/PluginRPCScopePolicy.js` and
`Implementation/property/PluginPermissionPolicy.js` for exact
manifest restrictions. A scope supports exact target/action only,
never wildcard matching or implicit child scopes.

## 5. Event lifecycle and race safety

`Cluster.onSessionChange(listener)` returns an unsubscribe function.
Valid states in the Worker SDK are `ready` and `suspended`.
On unload, stop new requests and release handlers. On reload,
assume a fresh Session and recheck registration and permissions.

The authoritative EDPMU `PluginLifecycleEventPolicy` records the
`WorkerSDK.SessionChange` event. Its Payload is a string:
`"ready"` when `cluster-session-hello` succeeds, or `"suspended"`
when the Host suspends the Session. Listener callbacks run in Set
registration order within a message; unrelated RPC chains have no
global ordering guarantee. The Event tab displays this Payload,
trigger source, and unsubscribe contract. The same formally registered
Event policy describes `UICO.OwnedClick`: after a plugin-owned node
subscribes using `UICO.uiRequest` / `UI.Subscribe`, a DOM click
routes `{ uiId: string }` to the declared `subscriptionId` action on
the owning Object. `UI.Unsubscribe` removes that listener. This is
scoped to the owned UI node; it never grants native DOM mutation.

Use `AbortSignal` and `deadlineMs` for long-running Host requests.
Do not assume messages from separate request chains are totally
ordered. Observe `snapshotRevision` when traversing catalog pages;
on 409 restart from the beginning. Never automatically replay a
non-idempotent write after a timeout or revocation.

## 6. Static catalog consistency and EHU

Live URU/EDPMU registration is the authoritative source.
If a separate static artifact must be maintained, the trusted Host
calls `LinkCore.verifyStaticCatalog(manifest)` using records with
`owner`, `id`, `version`, `file` and `line`.
A stale version emits a `Catalog.StaticConsistency` EHU with
`CATALOG_VERSION_MISMATCH`, actual/expected versions and relative
source file/line. No source location is inferred by guessing.

`npm run check` runs `scripts/verify-api-catalog.mjs` and blocks
source version mismatch for annotated UICO, HubUnit Protocol and
Worker lifecycle Event contracts. The EHU includes file, line, owner,
API ID and the mismatch code. Runtime third-party packages supply
their own manifest; Host must not infer their Worker source lines.

Export from the Plugin Manager always requests every authorized
category regardless of the selected page/search/filter. The exporter
checks all five category revisions and counts before and after
SHA-256 computation;
409 blocks downloads of inconsistent results.

## 7. Known incomplete acceptance areas

A docs-only plugin E2E fixture verifies installation, Session ready,
Worker SDK request routing and uninstall without importing Host source.
This is an automated proxy, not an independent human blind test.
Unannotated runtime plugins and native Events that lack an authoritative
descriptor cannot have guessed schemas or line numbers. See
Acceptance-Matrix.md for the exact outstanding acceptance requirements.
