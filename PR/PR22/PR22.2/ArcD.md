# PR22.2 ArcD — Activity pipeline

## Object and Property
No new global Object/Property. Existing:
PluginLocalAgentObject, PluginUIHostUnit, PluginShellApprovalObject,
PluginExplorerObject, OMU and HubUnit.

## Event chain
ChatGPT MCP -> native /mcp/call -> browser WebSocket tool_call
-> PluginLocalAgentObject.dispatchShellTool
-> onActivity(requested) -> PluginUIHostUnit
-> iframe cluster-agent-activity -> agent feed.
Approved result -> native gateway -> HTTP response
and optional powershell_execution_result -> onShellResult
-> PluginUIHostUnit bounded forwarding -> iframe feed.

## Failure/EHU
Denied tool -> EHU 403 in OMU and activity denied;
native HTTP 403 for denied browser results or unapproved PS.
Native PowerShell nonzero exit -> result still returned with
actual exitCode, stdout, stderr; feed marks nonzero as failure.
Malformed or unsolicited messages remain protocol-denied.

## Relation codes
LocalAgent <-> HubUnit 11; LocalAgent <-> Explorer 11
when authorized; LocalAgent <-> Shell 11 when enabled.
iframe -> filesystem 00 (untrusted). Host -> iframe
observational message only; no permission granting.

## Testing
Regression: activity sanitization, denial lifecycle,
iframe markers, gateway HTTP error mapping.
Actual Windows Gateway + browser must be independently
verified for end-to-end command execution and output.
