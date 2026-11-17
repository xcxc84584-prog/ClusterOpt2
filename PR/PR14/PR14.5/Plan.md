# PR14.5 — Plan

## References reviewed
- Legacy `xcxc84584-prog/Cluster/agent_terminal/server.cjs`:
  provider_get returns only configured/model, provider_set accepts an
  API key and stores it locally, task sends a model completion request,
  task_cancel aborts the current task; model task timeout 90 seconds.
- Legacy `plugin_ai_agent/agent.js`: model setup, text input, output,
  task status, cancellation, and separate connection UI.
- Current PR14.4 v14.4.3 handoff, latest OCDA property registry,
  PR13 manifest/permission and PluginSandboxBridge constraints.

## New components
- `Implementation/property/PluginModelTaskPolicy.js`: immutable
  bounded payload and response validation; not a global EDPMU Property.
- `Implementation/object/PluginModelTaskObject.js`: transient model
  metadata and task lifecycle; registered dynamically in URU.
- Host PluginLocalAgentObject protocol extension: accepts only bounded
  legacy provider/task response types and sends commands through the
  authenticated socket. Model key input remains in the trusted host
  modal; no Hub payload transports a secret.
- `PluginUIHostUnit`: generic verified UI events to appropriate OCDA
  Object through HubUnit; transmits only sanitized state to iframe.
- AI Agent plugin HTML and zh-Hant/en locale JSON: model settings,
  status, text output, send, cancel.

## Permissions
- network.request + local-agent.pair: PR14.4 prerequisite.
- model.configure: model settings and model status.
- model.task: text task submission and cancellation.
All are separate privileged grants and rechecked on invocation.

## EventChain scheduling / performance
- The Model Task object serializes state mutations and request IDs.
- `taskStart` sends an asynchronous message and returns quickly,
  allowing cancellation on subsequent Requests while the Windows
  Agent executes a separate model request.
- The Local Agent Object and Model Task Object are scheduled via
  existing bounded HubUnit scheduling; unrelated objects remain
  parallel. No polling or buffering of network key material.
- Prompt max 8,000 chars; output max 65,536 chars; one active task
  per instance; UI retains up to 40 displayed messages.

## Security and identified tradeoffs
- Current legacy Windows Agent stores provider data in a local
  JSON file; at-rest encryption has NOT been verified. Do not describe
  the existing Agent as encrypted or keychain-backed.
- The plugin iframe remains opaque-origin with no network connection;
  it can request only host-mediated model operations after grants.
- No `bridge_register`, `tool_call`, shell, file or OAuth action.
- Actual browser-to-Windows integration and provider inference are
  outside mock transport test coverage.
