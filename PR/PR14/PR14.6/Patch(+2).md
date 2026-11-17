# PR14.6 Patch(+2) — CI and revoked UI state
- Read GitHub Actions logs for the previous commit.
- Identified PR14 Explorer VTE fixture paths triggering the existing
  absolute-machine-path code-convention check.
- Switched fixtures to dynamically composed path values; did not
  weaken the lint rule or alter shared core code.
- Fixed ToolBox UI state after provider disable: close the menu, clear
  the root label, uncheck all permission toggles.
- Verified the prior PR14 baseline remained Draft PR #61.
- Validation: fresh GitHub CI running. No full PASS claim yet.
