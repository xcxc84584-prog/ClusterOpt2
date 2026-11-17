# AI AGENT MCP(ChatGPT) — PR14 / PR15 resource package

In ClusterOpt2 Resources, download the complete plugin ZIP only to install
the browser plugin. Extract it and mount the plugin folder.

For full instructions see [MCP-SETUP.md](MCP-SETUP.md).\n\nFor Windows Local Agent setup, open the AI Agent tab and click
**下載 Quick-Setup.cmd**. This downloads one CMD file, not the ZIP.
The CMD downloads a revision-pinned setup helper and Agent files
after confirmation, then installs dependencies and starts a loopback
service. Nothing runs automatically from the browser.\n\nFor the separate ChatGPT MCP server, click **下載 MCP 快速配置 CMD**.\nThe second standalone CMD retrieves revision-pinned MCP/OAuth gateway files,\nstarts the local bearer gateway and offers an opt-in OAuth configuration\nwindow. Configure a separate trusted HTTPS proxy to OAuth port 43879;\nthe script never starts a public tunnel.

If port 43881 is occupied, choose **P** to select another port,
**C** to cancel safely, or **O** to inspect owning PID(s) and require
typing OVERRIDE before terminating any process. Enter the selected
port and pairing token in the trusted host pairing dialog.

Review and approve the six requested privileged capabilities:
`network.request`, `local-agent.pair`, `model.configure`,
`model.task`, `shell.execute`, `mcp.read`. Each is separately revocable.

## Current UI and protocols
The installed plugin adds an AI Agent button beside PowerShell.
Its isolated UI supports Traditional Chinese / English, palette
sharing, host-mediated Local Agent pairing, connectivity check,
model setup, read-only task/operation output and cancellation.

To pair, start the legacy Windows Cluster Terminal Agent configured
for the exact browser Origin. Enter its 64-character token in the
trusted host dialog. Only the host sends it to the local loopback
WebSocket. Never enter the token or model key in an untrusted iframe.

The model settings button opens a **trusted host dialog**. The API key
is delivered only to the already authenticated Windows Local Agent.
The browser does not save it. The **existing legacy Agent** persists
the model configuration on the Windows machine; protection of the
key at rest has not yet been verified. Only use a trusted machine and
a key appropriate to that environment.

The current model transport uses the legacy Agent OpenAI API path.
Existing model tasks remain host-managed and may be cancelled. The
plugin UI has no chat composer or task submission controls; ChatGPT MCP
is the intended external request surface, with ToolBox approval enforced
by the trusted host. The model's file/PowerShell tool calls are not supported.
Browser ToolBox, a separately consented PowerShell command bridge and\nread-only MCP projections are opt-in host features. OAuth cluster.read\nnow enforces a five-tool server-side allowlist; listing additional local\nMCP tools through stdio never grants remote write or PowerShell access. The built-in model task flow does not autonomously invoke these tools.

Worker `getStatus` and `describe` report the sandbox Worker's
own read-only contract. Live pairing, model and tasks are handled by
separate trusted host OCDA Objects, not by access to host globals
inside the Worker.

## Architecture
- Plugin package: plugin.json, worker.js, index.html, locale JSON.
- Host `PluginUIHostUnit`: isolated frame and capability-bound events.
- `PluginLocalAgentObject`: host credential dialogs, authenticated socket.
- `PluginModelTaskObject`: task IDs, transient state, cancellation.
- `PluginModelTaskPolicy`: bounded payload and result validation.
- HubUnit routes every inter-Object Request/Response, OMU records
  EHU/Log, URU owns live registrations. No persistent keys in UI.

## PR14.6–14.10 integration
The host-owned ToolBox supports explicitly selected folders with
independent read/create/update/delete grants. Browser-chosen directory
handles remain private to the trusted host, and a typed absolute path
is only a display/confirmation label. PR14.7 adds a separately enabled
PowerShell bridge with per-command browser approval; each shell request needs explicit host confirmation. PR14.8 adds
an independent MCP read-only switch. Its three browser-projected tools
are limited to list_files, get_editor_state and saved small read_file;
get_status and get_task_status are served directly by the local Agent.
Other MCP tools are denied unless separately implemented and approved.

The plugin-local legacy Node MCP/OAuth gateway files are bundled in
local-agent/. Run the separate PowerShell entry scripts explicitly;
installing a browser plugin never starts a Windows program.
The OAuth scope remains cluster.read; remote publishing requires a
trusted external HTTPS proxy and security validation.

PR14.9 resets transient ToolBox grants on disable, uninstall, failed
UI mount and agent disconnect. PR14.10 local Windows Agent, real
PowerShell execution, browser permissions and OAuth end-to-end checks
remain required before production acceptance.

Do not treat a mock WebSocket test as proof of a real model connection.

## Separate OAuth control scope
When explicitly requested, `cluster.control` advertises all 14 legacy MCP tools after a distinct authorization-page warning. Requests still pass through the already paired Local Agent, browser ToolBox grants and per-command PowerShell user confirmation; it is **not** a direct shell endpoint. Ordinary `cluster.read` tokens remain five-tool read-only. See MCP-SETUP.md.

C/P/O is now shared by the Local Agent, MCP Gateway, and OAuth Gateway launchers. Defaults: 43881 / 43880 / 43879 respectively. Changed ports persist to the local service port configuration and must be reflected in browser pairing / HTTPS proxy settings.
