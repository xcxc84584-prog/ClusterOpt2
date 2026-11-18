# PR21.3 ArcD — UI-first implementation

## Impacted Objects
- `PluginUIHostUnit`: trusted host ToolBox, source/origin verified messages and pairing UI.
- `PluginLocalAgentObject`: trusted one-shot pairing; credential persistence proposed but not implemented.
- `PluginHostInstallUnit`, `PluginPackageStoreUnit`: reviewed install/opt-out analysis pending.
- Bundled `Implementation/plugins/ai-agent-mcp/index.html`: layout and in-panel guide.

No new global Property is introduced for the UI-only patch; `全域屬性清單.md` read before patch.

## Event chains
1. Guide click -> iframe state `showingGuide` -> setup/guide visible -> panel scroll top -> trusted pairing slot layout event.
2. iframe outside click -> `cluster-plugin-toolbox-close` -> host checks `event.source`, `event.origin`, mounted provider and enabled -> host closes only ToolBox; no privileges changed.
3. Escape -> guide dismissed and same host ToolBox close.
4. Panel scroll/resize -> bounding rectangles -> `cluster-plugin-pair-layout` -> host-only Port/Token overlay, no token in event.
5. Pair form submission -> host-only staging -> HubUnit `pair` with empty payload -> one-shot token consumed; unchanged.

## Relation and permission
Every host message is advisory UI state and cannot invoke a filesystem or shell permission. Host permission approvals remain separate. Token never passes to sandbox iframe. No HubUnit/OMU/URU/EDPMU core logic changes.

## Parallel execution
Scroll/resize layout can run independently from bridge health. Pair/disconnect remain serialized by existing Local Agent generation. Background service manager and protected credentials are deferred until secure implementation and tests.

## PR21.3 Patch(+2): new adapters / EventChains
- `default-ai-agent-launcher.js` (host bootstrap UI adapter): reviewed preference -> unprivileged launcher -> explicit consent -> bundled static snapshot -> PluginHostInstallUnit -> HubUnit/URU provider -> isolated iframe. No implicit privileged execution.
- `PluginPackageStoreUnit`: existing reviewed provider record reused. No new shared Property, registry or permission authority. Opt-out prevents default launcher on the next page load; an explicit activation is required every new runtime.
- `secure-store.cjs` (native helper): user-scoped DPAPI Protect/Unprotect via PowerShell stdin and fixed script. No secret in CLI arguments, URI or plugin messages. Legacy `pairing-token` and `ai-provider.json` are migrated after validation; decrypt failures stop native startup instead of regenerating an incompatible credential.
- `Background-Agent.ps1` (native user-initiated lifecycle): C/P/O Select-ServicePort -> hidden node process -> verify listener and Win32_Process -> persist verified PID/start/executable/port record. Stop -> recheck full fingerprint and listener -> terminate only same owned process. Token action -> decrypt DPAPI file as same Windows user.

### Safety and relations
`Launcher -> PluginHostInstallUnit` is a host-only opt-in request; `PluginLocalAgentObject` maintains the sole pairing authority. The browser never receives DPAPI ciphertext. ToolBox and shell permissions remain explicit. User account privilege and C/P/O are never escalated. Service process lifecycle is outside HubUnit; remote operations still require the same HubUnit/ACL routes.

### Validation state
Windows PowerShell 5.1 parsing: PASS (GitHub CI); DPAPI persistence and migration: PASS (Windows CI); Node unit suite: PASS on latest feature snapshot at 2026-11-18. Playwright full suite and real Windows background lifecycle: pending at documentation time.

## PR21.3 Patch(+3) UI identity reconciliation
On successful `PluginUIHostUnit.mount` (after `views.set`), a host-owned cleanup removes the inert default launcher for the Agent provider only. This executes on both reviewed default activation and user-selected folder installs, after the real panel has mounted. It does not add permissions or change HubUnit routes. On failed mount, existing rollback leaves the launcher available for retry.
