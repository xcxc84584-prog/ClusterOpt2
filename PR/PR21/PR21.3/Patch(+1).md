# PR21.3 Patch(+1) — In-panel guide / full-width scroll / ToolBox close

Base SHA: `5ebe730364c6b3a1dbf5892accc3d230a378dedf`.
Branch: `feature/pr21-3-ai-agent-ui-runtime`.
Release: unchanged `0.0.15b`.

## Root cause
The plugin iframe itself occupied 100% of its host panel, but `.cai-setup` was restricted to 740px and had its own Y-scroll. Host document outside-click events do not cross the iframe boundary.

## Files
- `Implementation/plugins/ai-agent-mcp/index.html`: use full-width setup, single main Y-scroll, guide navigation and outside-click notification.
- UI-only changes, retaining trusted host pairing overlay and existing Hub ACL.

## Verification
Static source inspection: completed.
Node syntax / contract: pending CI.
Playwright viewport and zoom: pending.
Windows ConPTY / OAuth: not run.
VTE: pending.
No other PR21.3 tasks are claimed PASS.

## Rollback
Reset branch to base SHA above. Do not merge before acceptance.
