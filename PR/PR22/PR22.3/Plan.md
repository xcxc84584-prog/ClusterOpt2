# PR22.3 Plan — ToolBox unattended PowerShell

## Goal
After explicitly enabling PowerShell in the trusted ToolBox, Agent can
open PowerShell and execute multiple commands without per-command dialogs.

## Scope
- Keep root selection, live Local Agent pairing, plugin capability,
  source identity and workspace name checks.
- PS grant is scoped to the current session; revoke on disconnect,
  plugin disable, root change or checkbox OFF.
- Reuse PluginShellApprovalObject and native Gateway protocol.
- Opening existing PowerShell UI and background execution are separate
  actions; output is forwarded to Agent activity feed.

## Security and load
This grants arbitrary Windows shell commands under current user;
it is not a filesystem sandbox. Grant is not persisted.
Native Gateway enforces 15 second timeout and bounded output.
Avoid hidden elevation, absolute paths, keys and secrets.

## Rollback
Main untouched; draft PR, backup ref after validation.
