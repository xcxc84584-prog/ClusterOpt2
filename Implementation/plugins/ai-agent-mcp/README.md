# AI AGENT MCP(ChatGPT) — PR14.4

This is an installable, sandbox-isolated plugin for ClusterOpt2.

## Installation
In Resources, select and install this local plugin folder. Review both
requested capabilities before approving the installation:
- `network.request`: privileged network request declaration.
- `local-agent.pair`: separately privileged Local Agent pairing.

Both are required for any Local Agent interaction. Approval is
explicit, session-scoped, and revocable in Plugin Permissions.

## Current functionality
- Independent AI Agent button next to PowerShell.
- Isolated output UI, bilingual zh-Hant/en labels, palette integration.
- Host-owned pairing dialog. Token input stays in the host and is
  never sent to the plugin Worker or its iframe.
- Pinned local WebSocket `ws://127.0.0.1:43879/agent` supporting only
  `auth -> ready`, `ping -> pong`, and disconnect.
- Per-call HubUnit/URU permission checks and OMU Log/EHU.
- Worker Provider contracts `getStatus({})` and `describe({})`.
  Worker status still describes its **own** contract-only capabilities;
  the separate host UI displays live Local Agent connection state.

## Required local setup
Start the *legacy Cluster Local Agent* on Windows with its origin
configuration matching the exact origin of the deployed ClusterOpt2
page. Use the pairing token printed by that Local Agent in the
**trusted host pairing dialog**. The token is not saved by the plugin.

## Security boundaries
This PR deliberately does not send `bridge_register` and does not
process any `tool_call` messages. Unsolicited tool messages cause a
connection shutdown. The local connection does **not** grant permission
to access files, execute PowerShell, configure models, create tasks,
or expose MCP/OAuth endpoints.

## Deferred
- PR14.5: model provider and task pipeline.
- PR14.6: Explorer CRUD with granular file capabilities.
- PR14.7: approved PowerShell execution.
- PR14.8: scoped MCP/OAuth gateway.
- PR14.9–10: lifecycle and final real-machine security acceptance.

No API keys, machine-specific absolute paths or development-only
prompts are written into user-facing UI.
