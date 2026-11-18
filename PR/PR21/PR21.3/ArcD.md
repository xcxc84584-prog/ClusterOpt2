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
