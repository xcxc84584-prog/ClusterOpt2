# PR21.1 ArcD — EventChains, authorization and boundaries

## Architecture

```text
Product ReleaseVersion (EDPMU single source)
  → SystemVersion property (HubUnit) → Setup CMD version
  → native installer ExpectedVersion validation
  → version-matched local-agent/package.json

AI AGENT MCP(ChatGPT) iframe (opaque sandbox)
  → toolbar ToolBox menu toggle / guide / test / disconnect
  → PluginUIHostUnit (validated iframe source/origin)
  → trusted PluginExplorerObject + PluginShellApprovalObject
  → HubUnit Request/Response → OMU EHU/Log
  → local Agent authenticated bridge (43881)
  → MCP (43880), OAuth (43879)
```

## New Object/Property registry
No new Object and no global Property. The existing PluginUIHostUnit's installed-plugin interface gains three typed messages:
- `cluster-plugin-toolbox-toggle` and `cluster-plugin-toolbox-close` — toggle/revoke menu visibility only; never change permissions.
- `cluster-plugin-download-package` — trusted download of an allowlisted, reviewed ZIP; no automatic install.
The ToolBox host controls individual permission bits, browser folder access and shell approval through existing OCDA Objects; no iframe access to those resources.

## Event chain and tests
- Toolbar click → authenticated iframe message → host menu open/close event → GUI state; repeat click/ESC closes.
- Download button → authenticated iframe message → host ZIP allowlist → user download; failed asset → EHU.
- CMD from LinkCore version → Windows PowerShell version validator → package manifest parity → Agent startup, or early rejection without process termination.
- Relation/authorization VTE: unapproved plugin install 403; restricted resources 403; output view does not expose model controls; guide ZIP does not grant capabilities; model task transport still tested by trusted host API, not obsolete UI controls.
- A rejected request is audited in existing OMU, with original EHU cooldown and Log rules unchanged.

## Relative structure
Implementation/plugins/ai-agent-mcp/{index.html,locales/*.json,MCP-SETUP.md,local-agent/*}
Implementation/LinkCore/PluginUIHostUnit.js (plugin-interface adaptation only)
Implementation/main/plugin-agent-download.js (approved ZIP catalog)
Implementation/local-agent/install-current.ps1 (installer compatibility)
Implementation/property/ReleaseVersion.js (sole version authority).
