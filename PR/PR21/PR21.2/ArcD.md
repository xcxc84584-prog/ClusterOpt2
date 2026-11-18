# PR21.2 ArcD

```text
Iframe setup slot (layout only)
  -> source-validated postMessage(pair-layout)
  -> trusted PluginUIHostUnit renders Port 1fr + Token 3fr
  -> trusted PluginLocalAgentObject.stageHostPairing
  -> HubUnit Request(ui -> PluginLocalAgentObject, pair, {})
  -> single-use trusted credential consumed in askToken
  -> authenticated ws://127.0.0.1:Port Local Agent
  -> ready / forbidden -> OMU Log/EHU + host feedback

PS 43881 occupied -> C/P/O -> explicit O identity guard
 -> changed owner -> warning, return to CPO without kill

MCP CMD -> five call :download subroutine requests
 -> asset verified/atomically moved or filename + URL/error reported
```

No new shared Property or Object. Existing Host / Local Agent, shell approval and read-only MCP bridge remain registered through URU/Hub and observed by OMU. Request/Response does not carry the token. Changed-PID guard maintains fail closed. Reverse proxy and public OAuth ports unchanged (43880/43879).
