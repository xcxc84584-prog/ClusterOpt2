# PR22.3 ArcD

No new Object or global Property. Existing trusted ToolBox owns
authorization; Explorer stores root and PS right; ShellApprovalObject
checks session; LocalAgentObject routes through HubUnit; Gateway runs PS.

Event chain A: UI SelectRoot -> ToolBox PS ON -> validate provider
capability -> registerShellBridge -> Shell.setEnabled(true) and
Explorer.ps=true -> OMU Log.

Event chain B: Agent open_powershell -> LocalAgent -> Explorer.status
-> trusted PowerShell UI button -> result -> Agent feed.

Event chain C: Agent powershell_request -> HubUnit Request ->
Shell.approve (source, workspace, live right, capability, command)
-> approved:true without modal -> Gateway launches bounded PS process
-> stdout/stderr/exitCode -> Agent feed.

Event chain D: root change/PS OFF/disconnect/plugin disable ->
Shell.revoke + bridge disable -> next command denied EHU 403.

Relation: LocalAgent <-> Shell and Explorer: 11 when authorized.
Untrusted iframe -> PS: 00. Concurrent shell tasks are native bounded
processes and never grant privilege themselves.
