# PR23.1 Patch(+1) — Add PMU layer

## Changes
1. Add `Implementation/LinkCore/PluginManagerUnit.js` containing PMU, OCU, PCU and UCU.
2. Wire a host-only `pluginManagerUnit` instance in `LinkCore.js` after existing plugin host construction.
3. Add `Implementation/tests/pr23-plugin-manager-unit.test.js` for three channels, authorization, bridging and isolation.
4. Preserve `Implementation/LinkCore/HubUnit.js` unchanged.

## Caveats / outstanding
- UCU currently controls a plugin's existing UI view only; new UI Slots and arbitrary UI replacement require a subsequent PR.
- The existing PluginSandboxBridge is NOT yet wired to PMU message channels; PMU is available to trusted host code, not to an untrusted plugin's worker.
- No new privileged CRUD is created; host-granted permission requires explicit trusted approval.
- Existing plugin install/uninstall lifecycle remains in PluginHostInstallUnit.
- Node / browser CI status must be checked on the PR SHA.
