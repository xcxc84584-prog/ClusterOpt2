# PR22.1 ArcD

## Objects / Properties
No new Object or Property. Reuse:
- PluginUIHostUnit: trusted ToolBox controls and browser permission request
- PluginExplorerObject: root + per-operation access guard
- PluginLocalAgentObject: MCP bridge registration and dispatch
- PluginShellApprovalObject: explicit PowerShell command approval
- OMU: PASS Log and FAIL/EHU audit

## Event chains
1. UI.SelectFolder -> native directory picker -> browser read
   permission -> PluginExplorerObject.setRoot -> OMU.Log.
2. UI.Check(Read/Create/Update/Delete) -> browser read/readwrite
   permission -> PluginExplorerObject.setRight -> OMU.Log.
3. UI.Check(PS/MCP) -> validate root + plugin capability ->
   register bridge on connected Agent -> enable permission -> OMU.Log.
4. Agent.ToolCall -> PluginLocalAgentObject -> HubUnit.Request ->
   PluginExplorerObject.receive -> permission/path check ->
   Response -> OMU.Log/EHU.
5. Shell request -> PluginShellApprovalObject.approve -> explicit
   user confirmation -> local PowerShell execution only if approved.

## Relation
UI -> PluginExplorer: 11
PluginLocalAgent -> PluginExplorer: 11 when registered
PluginLocalAgent -> PluginShellApproval: 11 when registered
Unregistered Plugin/Agent -> PluginExplorer: 00

## Failure handling
Missing root: 409 in Explorer Object; ToolBox displays Select folder.
Denied browser grant: 403, no permission elevation.
Rejected tool request: return denied; no silent retry.
