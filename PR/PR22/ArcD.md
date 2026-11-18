# PR22 ArcD — bounded Shell approval and fixed toolbar

## Object
- `PluginShellApprovalObject`: retains `receive("approve", payload, context)` with strict `context.source === agentId`, active session, `explorer.rights.ps`, selected root and the three required plugin capabilities. Workspace is `payload.path === explorer.root.name`; Unicode names are permitted but controls and separators are rejected.
- `PluginLocalAgentObject`: unchanged ToolCall -> HubUnit request -> approve -> tool_result path. [403] is emitted for a denied approval; no new entry point.
- `PluginUIHostUnit`: trusted ToolBox remains host-owned, unchanged.
- Bundled plugin `index.html`: `.cai-bar` is non-scrolling flex child of `#clusterAiPanel`; only `#caiContent` scrolls setup and log.

## Event Chains
1. Remote `cluster.powershell_request` -> existing Local Agent tool bridge -> `PluginShellApprovalObject.receive("approve")` -> exact Unicode root name + permissions -> existing Hub Response -> approved tool_result or EHU; no direct execution.
2. Browser scroll event -> `#caiContent.scrollTop` -> log content moves -> `.cai-bar` stays at constant viewport Y position; pairing overlay layout is still bounded by the content scroll.
3. Revocation -> existing shell object revoke + bridge disable -> future calls denied; no implicit reauthorization.

## EHU
Denied source/rights -> 403; invalid command/workspace mismatch/unsafe segment -> 400; authorized same-root command -> 200. Existing EHU reporting preserved; no new global Property.
