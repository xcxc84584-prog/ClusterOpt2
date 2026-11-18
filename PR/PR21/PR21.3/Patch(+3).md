# PR21.3 Patch(+3) — real Agent mount removes default launcher
Base: `5ebe730364c6b3a1dbf5892accc3d230a378dedf`.
Branch: `feature/pr21-3-ai-agent-ui-runtime`.
Release: `0.0.15b` unchanged.

## Failure evidence
OCDA CI browser at `a13594e2`: 135 tests, 133 PASS, 2 FAIL.
Affected: PR14.3 AI Agent toolbar relationship and PR16 Agent workbench tab. Both expected real Agent's previous sibling `explorerPowerShell`, but received `pluginBundledAgentLauncher`.

## Fix
`Implementation/LinkCore/PluginUIHostUnit.js`: after Agent mount succeeds and the provider view is registered, remove the first-party default launcher. Covers direct folder install and reviewed activation; no change to core editor, capability contracts, identity or trusted pairing.

## Validation
- Unit suite: PASS at previous `a13594e2` state.
- Windows DPAPI / PowerShell parser: PASS at previous snapshot.
- Playwright after this fix: Pending new run.
- Native Windows background lifecycle: Not run.
- Merge: blocked until all required gates PASS.

## Rollback
Restore feature branch to the previous commit or main recovery SHA. No global Property modifications.
