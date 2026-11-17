# PR14.10 Patch(+2) — security hardening and CI correction

## Integration
- Scoped Explorer File System Access and ToolBox path confirmation.
- Per-command PowerShell consent; plugin-local legacy server permits
  approved commands without requiring a separate terminal tab.
- MCP read-only host Object and bundled local stdio/bearer/OAuth gateways.
- Explicit Manifest capabilities shell.execute and mcp.read in addition
  to network.request, local-agent.pair, model.configure, model.task.
- Revoke privilege on disable, disconnect, uninstall and failed UI mount.
- OS results rendered inside trusted host ToolBox, never sent to iframe.

## Tests
Node/VTE adds shell ACL and read-only MCP denial tests; Chromium adds
folder authorization, command confirmation, MCP request/denial and
lifecycle reset. Syntax checks cover local .cjs services. The earlier
Node 2-failure checkpoint was fixed (malformed tool status and
unregistered actor test). Final CI verdict belongs to the newest head.

## Release blockers
Real Windows native command execution; OS permission prompts;
HTTPS OAuth PKCE; model credentials at-rest protection; live model
inference; full adversarial load tests.
No claim that mock-only CI proves those environments.
