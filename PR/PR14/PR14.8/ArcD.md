# PR14.8 ArcD

## Objects and dependencies
PluginMCPReadOnlyObject; PluginLocalAgentObject read bridge; local-agent/*.cjs and startup scripts

## EventChain
User enables MCP Read-only -> authenticated WS -> bridge_register -> tool_call -> HubUnit -> PluginMCPReadOnlyObject -> bounded projection -> tool_result; OAuth PKCE authorization belongs to the separate local Node gateway.

## Relation
Default 00. Only host-authorized source Object and user-approved
capabilities may initiate requests through HubUnit. Replies remain
bounded. OMU records all denials as EHU and successful events as Log.

## Error handling
400 invalid input; 403 denied capability; 404 missing target;
409 conflicting action; 413 size limit; 503 missing service;
504 timeout. No secret, full path or file contents in EHU.
