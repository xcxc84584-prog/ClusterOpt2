# PR21.1 Patch(+1) — v0.0.15b

- Fix `Implementation/local-agent/install-current.ps1` argument ValidatePattern for single-letter release suffixes, including `0.0.15a` and `0.0.15b`.
- Update sole `ReleaseVersion.product` and two package mirrors to `0.0.15b`; preserve `stable` channel, synchronize regression tests.
- Refactor plugin `index.html` legacy-style dark UI: one toolbar with ToolBox, Connection Guide, Ping, Disconnect and close; remove model settings/status/stop and chat input.
- Move guide outside connected-only Workspace so downloads available before pairing; include full plugin ZIP, Local Agent setup and MCP setup downloads.
- Keep dropdown menu exclusively in trusted `PluginUIHostUnit`; plugin iframe posts toggle/close messages; host validates source/origin; CSS supports viewport limits and Escape close.
- Include `MCP-SETUP.md` inside packaged ZIP; normalize translation strings in zh-Hant/en.
- Update former UI tests and add PR21 contract checks for version suffix, UI control absence, guide download and trusted bridge.
- Await final CI and real Windows QA; do not claim local physical system test from GitHub Actions alone.
