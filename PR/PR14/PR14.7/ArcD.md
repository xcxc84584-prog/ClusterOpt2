# PR14.7 ArcD

## Objects and dependencies
PluginShellApprovalObject; PluginLocalAgentObject tool dispatch; ToolBox PS toggle

## EventChain
User enables PS -> Local Agent authenticated WS -> bridge_register -> tool_call -> HubUnit -> PluginShellApprovalObject -> native confirmation -> tool_result -> legacy local service

## Relation
Default 00. Only host-authorized source Object and user-approved
capabilities may initiate requests through HubUnit. Replies remain
bounded. OMU records all denials as EHU and successful events as Log.

## Error handling
400 invalid input; 403 denied capability; 404 missing target;
409 conflicting action; 413 size limit; 503 missing service;
504 timeout. No secret, full path or file contents in EHU.
