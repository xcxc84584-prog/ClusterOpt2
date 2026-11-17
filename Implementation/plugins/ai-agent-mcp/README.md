# AI AGENT MCP(ChatGPT) — PR14.5

Install this entire local plugin folder using ClusterOpt2 Resources.
Review and approve the four requested privileged capabilities:
`network.request`, `local-agent.pair`, `model.configure`,
`model.task`. Each is separately revocable.

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
No `bridge_register`, filesystem modification, OS command or
MCP/OAuth execution is enabled.

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

## Remaining PRs
14.6 authorized Explorer CRUD; 14.7 approved PowerShell execution;
14.8 MCP/OAuth; 14.9 lifecycle, 14.10 full security, real-machine
and end-to-end integration acceptance.

Do not treat a mock WebSocket test as proof of a real model connection.
