# PR22 Patch(+1) — 2026-11-18

Reproduction: the user's EHU shows `Plugin.Shell.InvalidRequest` and `Plugin.LocalAgent.ToolDenied` at the same timestamp as `cluster.powershell_request [403]`. Plugin Manager has `shell.execute` granted and ToolBox has PS Auto-run checked.

Change:
- `PluginShellApprovalObject`: the strict ASCII regex for an exact Explorer root name is removed, permitting CJK root names. Still reject mismatch, control characters and path separators.
- `index.html`: fixed toolbar outside `#caiContent` scroll; event append and pairing layout follow new scroll owner.
- `pr22-shell-unicode-workspace.test.js`: allows Chinese root and rejects other roots, traversal and revoked approval.
- `pr21-3-agent-layout.spec.js`: update scrolling contract and verify toolbar Y remains fixed as log scrolls.

Rollback: feature branch not merged; baseline main SHA in Plan. Release version unchanged. 
