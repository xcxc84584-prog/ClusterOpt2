# PR24 Patch(+11) — Durable RPC denial and upgrade safety

Date: 2026-11-20. Pull Request #80 remains **Draft**.
Target: PR24.46 and PR24.76, with partial PR24.47/75/77.

## Functional change
1. New `PluginRPCRevocationStoreUnit` persists **deny-only**
   providerId + target/action/property tombstones using separate
   private IndexedDB storage. Its data is *never* a capability grant.
2. PluginHostInstallUnit checks stored denials prior to Worker
   bootstrap for packages with RPC scopes. Even when a manifest and
   the Host's approved-scopes array contain a revoked route,
   only remaining unrevoked scopes are attached to the new Gateway.
3. Scoped activation fails closed with 503 on persistent denial read
   failure. Unsandboxed package data-only save remains unchanged.
4. Plugin Manager awaits `revokeRpcScopePersisted`, which first
   revokes live scopes and aborts matching in-flight requests,
   then writes the denial record. On write failure, the Provider
   is disabled and reverse transport suspended; the UI reports
   that durable revocation could not be confirmed.
5. A fresh explicit **reapproval ceremony** to clear a durable
   denial is a separate, future deliverable. Ordinary package
   reinstallation or `approvedRpcScopes` alone cannot re-grant.
6. PluginSandboxBridge exposes `pendingHostRequestCount`
   spanning Host→Plugin invocation map and Plugin→Host active
   MessagePort request reservations. Installer refuses upgrade
   with 409 if this or HubUnit.providerInflight is nonzero,
   **before** old Provider unregister/teardown.
7. No public Worker method, unrestricted Host API, second URU
   Provider registry or EDPMU authority introduced.

## Tests added/updated
- `pr24-rpc-revocation-persistence.test.js`: VTE Host restart
  with shared deny records, denied-scope filtering, storage
  failure disables Provider, reverse pending upgrade 409,
  malformed store scope rejection.
- Existing isolated installer unit fixture uses an explicit
  in-memory denial-list stub rather than browser IndexedDB.
- `pr24-persisted-revocation.spec.js`: real Chromium page.reload,
  IndexedDB persistence and isolated Worker RPC route denial
  with unrelated Property.Read still usable.
- `pr24-upgrade-safety.spec.js`: real Worker noncooperative Host
  reverse call must block upgrade; invalid replacement Worker
  should restore original Provider, Bridge, Session and UI.

## Security / remaining limitations
- IndexedDB denial storage is deny-only. Concurrent browser tabs
  and multi-port revocation broadcasting are **not** covered yet.
- Automatic restoration from an old approved built-in plugin is
  still a separate path; scoped built-in plugins would fail closed
  without explicit route approval. Imported untrusted packages
  stay inert until user consent.
- If browser storage is denied, scoped plugins cannot start or
  reinitialize until denial-state reads work; this is intentional.
- The current Host installer does not offer a per-route positive
  regrant UI. Existing persisted denials remain sticky after
  explicit install/upgrade; user must not be told this is a bug.
- Abort cannot undo already completed Host side effects.
- Cross-provider SDK, per-plugin resource quotas, memory pressure,
  full 100-subPR evidence, and formally approved release are pending.

## Merge policy
Exact-final-HEAD workflow success must be checked independently.
Older completed or cancelled runs cannot be used to pass this patch.
Draft remains open until complete VTE, external plugin conformance,
rollback backup and 100-item acceptance.
