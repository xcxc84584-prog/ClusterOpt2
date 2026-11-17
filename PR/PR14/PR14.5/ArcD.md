# PR14.5 — ArcD

## OCDA and dataflow
```text
AI AGENT MCP(ChatGPT) isolated UI
              |
        Host message filter
              |
        PluginUIHostUnit
              |
         HubUnit Request
              v
   PluginModelTaskObject
     Request / Response
   state + task correlation
              |
        HubUnit Request
              v
   PluginLocalAgentObject
     host-owned key dialog
     authenticated WebSocket
              |
    127.0.0.1:43879 /agent
              |
    legacy Windows Agent
      local provider store
      text model inference
              |
 provider_info / task_status / task_result
              |
 PluginLocalAgentObject -> HubUnit -> PluginModelTaskObject
              |
      sanitized UI update
```

## Object contracts
PluginModelTaskObject:
- EHU/Log: OMU; Request and Response:
  configure, modelInfo, submit, cancel, state, ingest, reset.
- UserAPI: configure, modelInfo, submit, cancel, state.
- AgentAPI: none.
- Property: none; Program: PluginModelTaskObject.
- Authorization: user actions Public but explicitly limited to
  source `ui`; `ingest/reset` only source=registered LocalAgent Object.

PluginLocalAgentObject:
- Existing PR14.4 UserAPI unchanged; host internal Request/Response
  now includes providerSet, providerGet, taskStart, taskCancel.
- Private credentials collected only in host modal; no key in
  Request payload, response, shared Property or Log.
- Non-authorized source or absent grant -> EHU 403.

Property: PluginModelTaskPolicy is a standalone algorithm, not
another EDPMU shared mutable state authority.

## Relation Code
- UI -> ModelTaskObject: 10 Request.
- ModelTaskObject -> LocalAgentObject: 10 Request.
- LocalAgentObject -> ModelTaskObject ingest/reset: 10 Request.
- Responses flow back through HubUnit (01).
- Model Task -> Explorer/PowerShell/MCP: 00.
- Model Task -> external provider network: no direct route.

## EHU and Relation Test
| Event | Expected |
| --- | --- |
| Missing model.configure | EHU 403 |
| Missing model.task | EHU 403 |
| Invalid/oversized prompt | EHU 400 |
| Duplicate active task | EHU 409 |
| Authenticated task submit | Log 200, generated requestId |
| Task status / result with correct ID | Log 200, transient UI update |
| Mismatched ID | EHU 409 |
| Forged ingest from UI | EHU 403 |
| Cancel in-flight task | Log 200, task_cancel sent immediately |
| Unpaired socket | EHU 503 |
| Disconnect/uninstall | task reset; no persistent host secret |
| Unsupported tool_call | EHU 403, disconnect (PR14.4) |

## Parallelism
The short model task dispatch releases HubUnit's per-object lock before
the asynchronous model completes. The Windows Agent owns the live task
AbortController and 90-second timeout. Task status ingest is sequenced
by the Task Object; other Objects may continue in parallel.
 
## Patch(+3) EventChain correction
```text
ModelTask.submit -> Hub -> LocalAgent.taskStart -> WebSocket.send
                -> Hub response / scheduler release
                -> queued reply (next event-loop turn)
                -> LocalAgent -> Hub -> ModelTask.ingest
```
Each queued reply is discarded if the observed connection generation
does not equal the current generation. EHU covers rejected replies.
