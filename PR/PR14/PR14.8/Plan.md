# PR14.8 Plan

## Goal
Bundle MCP stdio, bearer loopback MCP and OAuth PKCE gateways within plugin assets

## Implementation
PluginMCPReadOnlyObject; PluginLocalAgentObject read bridge; local-agent/*.cjs and startup scripts

## Security and load
No auto-run. OAuth cluster.read scope, five advertised read tools; browser only projects list_files/get_editor_state/read_file; status/tasks served by local service. No raw File Handle, unsaved data, local token or model key.

## Acceptance gate
Node syntax and browser protocol mock; actual Windows/HTTPS proxy/OAuth PKCE end-to-end requires user-controlled host.
