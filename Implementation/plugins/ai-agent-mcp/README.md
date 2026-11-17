# AI AGENT MCP(ChatGPT) — PR14 / PR15 resource package

In ClusterOpt2 Resources, download the AI Agent ZIP, extract it, then\nselect the extracted ai-agent-mcp folder with **Mount folder**.\nDo not select the ZIP itself. Run\n\`local-agent/Quick-Setup.cmd\` on Windows for opt-in Node.js setup,\nlocal dependency installation and pairing-token display.\nInstalling the browser plugin never\nstarts its included Windows local-agent scripts.
Review and approve the six requested privileged capabilities:
`network.request`, `local-agent.pair`, `model.configure`,
`model.task`, `shell.execute`, `mcp.read`. Each is separately revocable.

## Current UI and protocols
The installed plugin adds an AI Agent button beside PowerShell.
Its isolated UI supports Traditional Chinese / English, palette
sharing, host-mediated Local Agent pairing, connectivity check,
model setup, text-only prompts, task output and cancellation.

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
All tasks are text-only. Every task receives an ID and may be
cancelled. The model's file/PowerShell tool calls are not supported.
Browser ToolBox, a separately consented PowerShell command bridge and\nread-only MCP projections are opt-in host features. Model prompts remain\ntext-only and cannot autonomously invoke these tools.

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
