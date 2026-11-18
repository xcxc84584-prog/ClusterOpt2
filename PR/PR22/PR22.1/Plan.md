# PR22.1 Plan — AI Agent CRUD / PS ToolBox permissions

## PRD and objective
Resolve the observed `Plugin.Explorer.RootRequired` and repeated
`Plugin.Explorer.PermissionRejected` events without granting implicit
filesystem or shell permissions. Keep all access user-configurable
in the existing trusted ToolBox.

## Scope
- Reuse existing PluginExplorerObject, PluginLocalAgentObject,
  PluginShellApprovalObject, and HubUnit Request/Response contracts.
- Request a browser read grant when the directory picker returns
  `prompt` instead of treating it as an immediate failure.
- Require an Explorer root before enabling any filesystem or
  workspace-scoped PowerShell/MCP permission.
- Show actionable denial feedback for an individual checkbox.
- Keep per-command PowerShell approval and path confinement.

## Risk, load, and rollout
No new persistent credential, absolute path, global Property, or
ambient permission is introduced. User input continues through the
trusted host; plugin frame cannot access directory handles.
Each checkbox has at most one browser permission request.
Proposed as a Draft PR; main is the rollback point.

## Deferred
Investigate `Plugin.LocalAgent.UnexpectedAction` with a captured
redacted WebSocket message-type timeline. Do not disable bridge
handshake validation without evidence.
