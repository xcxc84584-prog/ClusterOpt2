# PR9 — Interaction parity and navigation
## Scope
1. Restore the actual editor scroll coordinates after reload, independent of caret position.
2. Reproduce the legacy Explorer's in-UI rename, copy/cut/paste, reorder, drag/long-press actions, including supported directory operations.
3. Implement line navigation without obscuring the editor at the bottom.
4. Restore native PowerShell invocation and its original multi-window lifecycle, with no web-terminal reimplementation.
## Out of scope
PR8's six-layer architecture acceptance remains an independent track. PR10 plugin execution stays postponed.
## Acceptance
Each Request/Response EventChain must pass deterministic unit/VTE tests and browser-level tests. Legacy parity must be checked against ClusterOpt, not assumed. No change to main before verified rollback and CI.

## Patch2 partial acceptance
Browser offers actual PowerShell via existing local-agent ConPTY route,
but the agent must be installed and paired explicitly. This does not
mean a static GitHub Pages site can launch powershell.exe itself.
