# PR21.1 Plan — v0.0.15b Legacy AI AGENT MCP UI and installer compatibility

## PRD
1. Fix PowerShell setup failure: `ExpectedVersion=0.0.15a` rejected by a strict PS ValidatePattern that did not accept alphabetic release suffixes.
2. Publish unified product version `0.0.15b` only through LinkCore ReleaseVersion property, mirrored to product and native Local Agent package manifests.
3. Retain completely isolated AI AGENT MCP(ChatGPT) plugin. Restore original Cluster dark AI Agent layout and dual-language connection guide, **without** model settings, model state, task stop or chat input.
4. Toolbar sequence: ToolBox | 連線教學 | 測試連線 | 中斷連線. Trusted ToolBox remains a host-side permission menu; iframe only sends a typed menu-toggle message. Responsive zoom and mobile viewport must not overlay global header.
5. The connection guide works before pairing and allows downloading a complete AI Agent plugin ZIP as well as two standalone Quick-Setup CMD files.
6. Preserve existing C/P/O defaults (Local Agent 43881, MCP 43880, OAuth 43879), permission checks, no hardcoded credentials or absolute machine paths.

## Prior study
Old Cluster `plugin_ai_agent/agent.js` + `agent.css` defines legacy header, connection guide, setup section and output feed. Current ClusterOpt2 `index.html` and `PluginUIHostUnit.js` are the isolated-plugin adaptation. Existing `Implementation/property/ReleaseVersion.js` is the authoritative version source; `scripts/sync-release.mjs` checks the two distribution package mirrors.

## Security and performance
- User UI never receives raw filesystem handles or pairing token; the trusted host owns picker and PowerShell approval.
- Plugin iframe has opaque origin and CSP; ToolBox message is accepted only from the mounted iframe after plugin capability validation.
- ToolBox is a dropdown menu, width <= viewport, scrollable with constrained maximum height, avoiding repeated rerender on typing/scrolling.
- Output feed remains bounded (40 messages × 65536 characters). Frame theme uses existing CSS property tokens.
- No changes to editor, HubUnit routing, EDPMU, URU or unrelated user APIs. Only the plugin host **interface adaptation** and native installer contract change.

## SOP
PRD → Plan → ArcD → Implementation + Relation Test → Project. Node, PowerShell parser and Playwright acceptance must pass on final release commit. Maintain a rollback branch before merging.
