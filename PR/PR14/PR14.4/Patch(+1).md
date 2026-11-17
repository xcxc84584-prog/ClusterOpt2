# PR14.4 Patch(+1) — Pairing transport + host permission gate

## New
- Implementation/property/PluginLocalAgentPolicy.js
- Implementation/object/PluginLocalAgentObject.js
- Implementation/tests/pr14-local-agent.test.js

## Updated
- Implementation/LinkCore/PluginUIHostUnit.js: host-only event bridge,
  explicit capability recheck, URU Object registration and teardown.
- Implementation/plugins/ai-agent-mcp/plugin.json: network.request grant.
- Implementation/plugins/ai-agent-mcp/index.html: Pair/Ping/Disconnect.
- Implementation/plugins/ai-agent-mcp/locales/*.json: bilingual copy.
- Existing PR14.2 and Chromium PR14.3 fixtures updated for explicit
  `network.request` approval.

## Security
No background network calls before host-initiated user pairing.
Token only via native host prompt and WebSocket auth frame, never
persisted. No task, bridge_register, tool result or shell commands.
No core HubUnit, URU, OMU, EDPMU or editor API change.

## Verification status
VTE mock handshake and negative tests committed; real browser and
real Windows Local Agent still require external acceptance evidence.
