# PR14.8 Patch(+1)

Delivered on Draft PR #61 branch pr14/ai-agent-mcp-audit.
PluginMCPReadOnlyObject; PluginLocalAgentObject read bridge; local-agent/*.cjs and startup scripts

Security: No auto-run. OAuth cluster.read scope, five advertised read tools; browser only projects list_files/get_editor_state/read_file; status/tasks served by local service. No raw File Handle, unsaved data, local token or model key.

Automated tests were added where supported; the following gate
must not be marked PASS without direct evidence: Node syntax and browser protocol mock; actual Windows/HTTPS proxy/OAuth PKCE end-to-end requires user-controlled host.

No core application business logic changed and no release version bump.
