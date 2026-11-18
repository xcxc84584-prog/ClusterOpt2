# PR22.2 Plan — Agent activity & PowerShell output

## PRD
The new read-only AI Agent feed fails to display MCP operation
requests, authorization outcomes, and native PowerShell output.
The legacy Cluster plugin_ai_agent/agent.js renders these events.

## Scope
Reuse PluginLocalAgentObject's existing authenticated WebSocket,
HubUnit request routing and OMU audit. Emit bounded, non-secret
activity metadata from the trusted host to the existing iframe feed.
Render PowerShell stdout/stderr/exit status, as the legacy UI did.

## API failure
The native gateway previously returned HTTP 200 for bridge tool
responses such as `{error: "Access denied"}` and denied shell
requests. Return explicit HTTP 403 instead. Keep exact-command
approval and scope enforcement; no blanket execution.

## Load and privacy
Bound feed to 40 messages; each message <= 65536 characters.
Output fields are individually bounded. No command strings,
tokens, file contents, or directory handles in activity metadata.
PowerShell stdout/stderr is visible only in this local user panel
and in existing ToolBox output; output could itself contain secrets,
so do not persist or log it into OMU.

## Compatibility
No LinkCore routing changes or new global Properties. Preserve
legacy sandbox separation and active user permissions.
