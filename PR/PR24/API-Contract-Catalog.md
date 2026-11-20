# PR24 API Contract Catalog — Source-Verified Subset

Status: **INCOMPLETE / NOT RELEASE-READY**. Updated 2026-11-20.
Scope: PR24.02, .04, .05, .10. This is a bounded, source-linked
inventory, **not** a claim that all actions have schemas or passed VTE.

## Source-of-truth precedence

1. Runtime URU registered Provider descriptors and enabled state.
2. HubUnit Object/Action and EDPMU Property access checks.
3. Host-approved exact rpcScopes and live Session/MessagePort binding.
4. Package Manifest `provider.provides` and its input/output schemas.
5. This document, which is descriptive only and grants no authority.

Catalog entries are **not authorization tokens**. Unregistered,
revoked, disabled or otherwise unauthorized routes must never be
advertised as callable to an untrusted Plugin.

## Common RPC envelope (source verified)

Source: `Implementation/property/PluginBidirectionalEnvelopePolicy.js`.

| Field | Request | Response | Cancel |
| --- | --- | --- | --- |
| protocol | `cluster.rpc/1` | `cluster.rpc/1` | `cluster.rpc/1` |
| direction | `plugin-to-host` or `host-to-plugin` | same | same |
| type | `request` | `response` | `cancel` |
| requestId | required, 1–96 ID chars | required | required |
| target/action | required ObjectPath + action | absent | absent |
| payload | required, JSON-safe | absent | absent |
| deadlineMs | optional, 1–30000 | absent | absent |
| parentEventId | optional positive safe integer | optional | absent |
| eventId | absent | required positive safe integer | absent |
| status/ok | absent | required, consistent HTTP-like status | absent |
| data/error | absent | success requires data; error requires code/message | absent |
| reason | absent | absent | optional, <=128 chars |

The common payload size is inherited from `PluginMessagePolicy`
(current Plan baseline 65,536 UTF-8 JSON bytes, depth 8). The
transport binds Session/Provider/Object identity separately. Plugin
fields such as `callerId`, `source`, `sessionId` must be rejected.

### Common errors documented by source and PR24 Plan

| Status | Meaning / examples | Scope |
| --- | --- | --- |
| 400 | INVALID_ENVELOPE / INVALID_REQUEST / INVALID_RESPONSE / INVALID_CANCEL | envelope validation |
| 403 | UNTRUSTED_SESSION; denied live RPC scope / ACL | session / authorization |
| 413 | PAYLOAD_TOO_LARGE | transport payload |
| 429 | request over capacity | RPC controller, verify route implementation |
| 499 | cancellation or revoked late response | lifecycle, verify route implementation |
| 503 | unavailable / circuit open | Host availability, verify route implementation |
| 504 | deadline exceeded | RPC timeout, verify route implementation |

Error mappings are not yet exhaustively traced per route. The full
canonical `errorCode` set and every branch outcome remain **OPEN**.

## Verified example Provider actions (Manifest contract only)

These `inputSchema` and `outputSchema` values are currently
`{"type":"object"}`, **not field-complete schemas**. They prove a
declared type, not the full PR24.04 requirement.

| Provider / Object | Action | Version | Permission / scope notes | Manifest |
| --- | --- | --- | --- | --- |
| example.sdk.echo / SDK.ExampleEcho | echo | 1.0.0 | Provider ACL enforced by Host | sdk/examples/echo/plugin.json |
| example.sdk.delegate / SDK.ExampleDelegate | delegate | 1.0.0 | requires exact SDK.ExampleEcho:echo rpcScope | sdk/examples/delegate/plugin.json |
| example.sdk.native-ui / SDK.NativeUI | createControls | 1.0.0 | UI permissions, Host UICO gate | sdk/examples/native-ui/plugin.json |
| example.sdk.native-ui / SDK.NativeUI | pressed | 1.0.0 | UI permissions, Host UICO gate | sdk/examples/native-ui/plugin.json |
| example.sdk.native-ui / SDK.NativeUI | status | 1.0.0 | UI permissions, Host UICO gate | sdk/examples/native-ui/plugin.json |
| example.sdk.native-ui / SDK.NativeUI | probeNativeACL | 1.0.0 | negative ACL probe, not a Host grant | sdk/examples/native-ui/plugin.json |

Manifest examples are not exhaustive URU/Host/UICO APIs, and their
visibility is subject to authenticated live discovery.

## Public SDK surface confirmed by README

Source: `Implementation/sdk/README.md`.

- `Cluster.handle(action, callback)`: declare a Host-callable handler
  for an already approved Manifest action.
- `Cluster.request(target, action, payload, options)`: reverse RPC
  via authenticated Host route.
- `Cluster.service(...)`: documented alias of request.
- `Cluster.onSessionChange(callback)`: ready/suspended listener.

SDK 1.0.0 is documented as ambient Worker API. A generic Provider
discovery/capability query is **not yet published**; no fictitious
`Cluster.services.list()` or privileged property-write API is implied.

## PR24.04 completeness gate (currently FAIL / OPEN)

Each **actual live callable Action**, including Host, Plugin, UICO,
Service and Property, needs: ObjectPath, action, Provider, visibility
(Public/Protected/Private), version, exact caller/permission/scopes,
strict field-level request schema, strict response schema, error
codes, EventChain/EHU owner, source registration location, and both
positive/negative conformance evidence.

The current manifests' generic object schemas do not meet this gate.
Do not mark PR24.04, .05, .10 or .100 PASS merely because this file
exists.

## Required source-to-runtime parity procedure (PR24.02)

1. Boot isolated VTE and enumerate URU registered enabled descriptors.
2. Enumerate HubUnit external callable actions, UICO actions/UISP and
   EDPMU property operations at the **same HEAD**.
3. Compare the exact `ObjectPath/Action/Version` keys to this catalog.
4. Flag undocumented live routes and catalog-only missing routes;
   identify their authorization and visibility.
5. For each route assert valid request/response, invalid payload,
   disabled provider, revoked scope, and forbidden caller.
6. Assert each response has correlated requestId/eventId, each
   failure has EHU/Dependency evidence, and no request bypasses HubUnit.
7. Run real multi-Worker MessagePort, VTE, browser E2E and exact-HEAD CI.

**Security:** never expose private route metadata through Plugin
discovery, and never loosen validators to make catalogs match.
