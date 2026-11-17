# PR14.5 Patch(+3) — Model reply scheduling and concurrency

## Failure mode
An authenticated Local Agent can emit task_status immediately after
taskStart returns from its WebSocket send. In the same event-loop turn
the ModelTaskObject may still hold its HubUnit scheduler lock while
awaiting the LocalAgentObject. Eagerly routing an incoming response
back to that ModelTaskObject can trigger cyclic nested waits.

## Fix
- PluginLocalAgentObject queues valid model protocol responses in
  arrival order, defers each ingestion one event-loop turn and dispatches
  through HubUnit to PluginModelTaskObject. This is a bounded
  message-handling path, not a bypass of OCDA.
- Every queued reply captures the current socket generation. On
  disconnect/disable/uninstall all older-generation replies are ignored.
- PluginModelTaskObject rejects provider reconfiguration while a task
  is active (409), avoiding a long-running credential dialog blocking
  task cancellation.

## Security
The queue never stores API keys. Task messages were already validated
by PluginLocalAgentPolicy and PluginModelTaskPolicy, and model
TaskObject ingest/reset accept only the registered LocalAgent sender.
No main, HubUnit, URU, OMU, EDPMU, Explorer or PowerShell changes.

## Pending verification
Real Windows Agent rapid-response, cancellation race, and task timeout
fault injection remain in unresolved list. Check final-sha CI.
