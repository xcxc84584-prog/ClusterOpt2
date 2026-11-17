# PR18.1 — Architecture and Event Chain

User -> AI Agent plugin setup button -> PluginUIHostUnit -> downloadAgentQuickSetup -> Quick-Setup.cmd
CMD -> pinned GitHub Setup-Quick.ps1 -> Node/npm checks -> P/C/O -> node-pty -> loopback Agent
User -> trusted PluginLocalAgentObject pairing dialog -> selected loopback port -> HubUnit/OMU

PluginSandboxBridge sandboxed srcdoc keeps default-src none, form-action none, frame-src none, connect-src none, and opaque sandbox; removes unsupported navigate-to directive only. No new Objects or Properties; only plugin-install/hosting interfaces and plugin-owned setup scripts are modified.

## EHU
Browser download/pairing faults use existing PluginUIHost and Local Agent EHU. Script errors remain printed to the user's local CMD without exposing tokens to page/CI logs.
