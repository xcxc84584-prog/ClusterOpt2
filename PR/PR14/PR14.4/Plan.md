# PR14.4 Plan — Authenticated loopback bridge

## Legacy references
`xcxc84584-prog/Cluster/agent_terminal/server.cjs`:
WebSocket endpoint `/agent` at loopback port 43879; Origin restricted
to CLUSTER_TERMINAL_ORIGIN; auth is a 64-character random hex token;
response `ready`, ping -> pong. Upon authentication, old browser used
bridge_register (deferred deliberately for safety).

## Architecture
- `property/PluginLocalAgentPolicy.js`: pure data validation and
  localhost endpoint contract; no EDPMU duplicate or token store.
- `object/PluginLocalAgentObject.js`: strictOCDA runtime gateway;
  accepts host UI only; owns WebSocket and volatile token input.
- `PluginUIHostUnit`: generic, authorized UI extension receives only
  three event names from the iframe; sends HubUnit Request with empty
  payload. Token is acquired inside the host and never goes to frame.
- Manifest permissions now includes `network.request`; installer
  requires explicit approval in addition to installation consent.
- UI adds Pair / Ping / Disconnect with zh-Hant/en labels.
- `pr14-local-agent.test.js`: isolated VTE mock WebSocket and EHU tests.

## Risks and limits
- Local Windows Agent must separately be launched and configured for
  the exact GitHub Pages browser origin. This PR does NOT ship or
  rewrite the legacy agent service.
- The server will reject different Origin, port, token and route.
- Old `bridge_register` intentionally omitted to prevent receiving
  active tool calls before PR14.6–14.8 capability authorization.
- User approval for `network.request` does not authorize arbitrary
  internet access; bridge URL fixed to 127.0.0.1:43879/agent.
- Browser CSP keeps plugin iframe network-disabled.
- Host-owned prompt is ephemeral; no remember-me feature.
- Parallelization: status reads independent; pairing/connection
  operations serialized by HubUnit resource key.
