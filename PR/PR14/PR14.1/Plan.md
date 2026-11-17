# PR14.1 — Legacy AI Agent audit and compatibility plan

## Scope and sources
- Source of truth (legacy): `xcxc84584-prog/Cluster` main, **not** ClusterOpt.
- Target: `xcxc84584-prog/ClusterOpt2` main; latest consulted handoff: `PR/PR13/總工作交接提示詞(v13.14).md`.
- Read before implementing: global properties inventory; PR13 ArcD/Patch14; current issue/test lists.
- Plugin name: **AI AGENT MCP(ChatGPT)**.
- PR14.1 is inventory and contract/test specification; no core runtime edits.

## Verified old-code inventory
| Area | Legacy paths | Behavior |
| --- | --- | --- |
| Browser AI UI | `plugin_ai_agent/agent.js`, `plugin_ai_agent/agent.css` | AI open/close/tab, feed, guide, model settings, bilingual labels, task submission/stop |
| Workspace policy | `plugin_ai_agent/permissions-ui.js` | Read/write/delete/PowerShell permission toggles, audit, session allow-all |
| Local agent | `agent_terminal/server.cjs` | Loopback WebSocket /agent, token pairing, model task, task cancel, browser tool bridge |
| MCP | `agent_terminal/remote-mcp.cjs`, `agent_terminal/mcp-stdio.cjs` | MCP tools/list, tools/call; local browser bridge |
| OAuth | `agent_terminal/oauth-mcp-gateway.cjs`, `tools/mcp/Cluster-ChatGPT-OAuth-Connect.*` | OAuth PKCE gateway, manual local consent, tunnel setup |
| Install | `agent_terminal/install-once.ps1`, `tools/mcp/*` | Windows install/start and connection workflows |
| Editor/Explorer | `plugin_CEXP/explorer-core.js`, `link_plugin_CEXP/explorer-ui.js` | Browser file-handle based Explorer authority |

## Confirmed legacy capabilities
- AI panel beside terminal workflow; bilingual setup, token pair, model configuration, chat task statuses and cancellation.
- Model requests handled in local agent through OpenAI chat completions; not a universal provider abstraction.
- Explorer tools: list_roots, find_root_windows_path, list_directory, read_path, create_file, write_path, delete_path.
- Terminal tools: open_powershell, powershell_request (explicit browser approval unless legacy allow-all setting enabled).
- MCP includes status/task/editor introspection and Explorer/terminal operations.
- Legacy remote OAuth connector documentation says **five read-only tools**; browser agent tool set is broader. Do not assume remote OAuth exposes full browser capabilities.

## Target constraints
- PR13 PluginSandboxBridge runs untrusted self-contained ES module in opaque sandbox/Worker with CSP; direct top-level DOM and host globals are not available.
- PluginHostInstallUnit uses HubUnit/URU and reviewed runtime grants; URU is sole Provider authority, EDPMU Property authority, OMU Log/EHU.
- No core change except independently justified plugin load/architecture defect; fix in separate narrowly scoped PR with regression tests.
- Plugin package may contain HTML/CSS/JS/assets as inert staged bytes, but UI activation/multi-file dependencies must be verified before claims of compatibility.
- All file/command authority must be mediated by capability-specific host adapters. Plugin cannot directly call window.ClusterCEXP, window.ClusterTerminal, filesystem, or OS process APIs.

## Next tasks / boundaries
14.2 manifest and typed Hub contract; 14.3 UI + Language; 14.4 pairing and transport; 14.5 provider and task pipeline; 14.6 Explorer; 14.7 shell consent; 14.8 MCP/OAuth; 14.9 lifecycle; 14.10 full VTE/browser/security acceptance.

## Risk and load budget
- 0 hardcoded keys, token files or absolute host paths.
- Prompt <=8000 chars for legacy parity, tool payload and outputs bounded per operation.
- Read_path legacy chunks up to 256 KiB; avoid whole-file loading.
- Multi-request EventChain: read-only operations may run concurrently when independent; writes to same file and PowerShell commands must serialize with cancellation and event IDs.
- Separate local loopback transport from remote OAuth; never expose local agent token via public tunnel.
- Do not persist broad execution grants across reload, reinstall or migration.
