# PR14.4 Patch(+3) — Pairing-specific capability isolation

## Security finding
Prior implementation used only generic network.request to authorize a
host-owned loopback Local Agent bridge. This was too broad: arbitrary
network permission must not imply the right to pair with an OS agent.

## Correction
- Existing PluginPermissionPolicy allowlist adds
  `local-agent.pair` as a separately reviewed privileged capability.
- AI Agent package Manifest now explicitly declares both
  `network.request` and `local-agent.pair`.
- PluginUIHostUnit creates the host Local Agent bridge only for a
  provider declaring both capabilities.
- PluginLocalAgentObject checks both *live* runtime grants for every
  pair, ping, disconnect or status call; denial triggers Hub EHU.
- PR14 Node/VTE and browser fixtures request both grants; additional
  negative test demonstrates network-only approval cannot pair.

## Plugin architecture boundary
The modification to PluginPermissionPolicy is limited to providing
a safer extensible plugin capability. It does not alter HubUnit,
URU, EDPMU, OMU, editor, Explorer, PowerShell or core release version.

## Validation
Review *latest-commit* Node/VTE and Chromium CI. Remote Windows Agent
real-origin tests remain unverified; no main merge.
