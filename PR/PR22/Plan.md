# PR22 — Shell Unicode Workspace and fixed Agent toolbar

Baseline: `cfeaf5493cdeefd1ff27376368c6d7e25ca73ead`.
Branch: `feature/pr22-ps-unicode-workspace-fixed-agent-toolbar`.

## Observed user defects (2026-11-18)
Screenshots show `Plugin.Shell.InvalidRequest` in EHU, followed by `Plugin.LocalAgent.ToolDenied` and remote `cluster.powershell_request [403]`, even though the six plugin capabilities and ToolBox PowerShell Auto-run are enabled. Another screenshot shows the AI Agent toolbar scrolls out of view with its event log.

## Root cause
`PluginShellApprovalObject.receive` applies an ASCII-only root-name regex to the *exactly matched* Explorer root name. A valid Chinese workspace such as `作業1` is denied as invalid request. `#clusterAiPanel` is the scroll owner for both its toolbar and log.

## Plan
1. Keep all existing permission, agent identity, root, command, and exact workspace-match checks. Replace only the ASCII-only character restriction with a length, control-character and path-separator guard.
2. Move scroll responsibility to `#caiContent` beneath the static `.cai-bar`. Setup and log content remain scrollable.
3. Add unit tests for CJK names and bypass attempts, browser test for toolbar geometry and scrolling, and update previous layout expectation.
4. Run existing OCDA/Playwright CI. Draft PR and main remain unchanged pending acceptance.

## Security and resource impact
No new capability or default permission; no shell command bypass. Existing per-session Auto-run approval remains explicitly controlled by ToolBox. DOM composition changes only; no additional listeners or storage. Existing OMU EHU/Log remains authority.
