# PR14.4 ArcD — OCDA Local Agent transport

## Object / Property
```text
AI Agent iframe --typed action only--> PluginUIHostUnit
                                               |
                               explicit network.request grant
                                               |
                                  HubUnit.Request(source=ui)
                                               |
                                  URU PluginLocalAgent.Object
                                               |
                              PluginLocalAgentPolicy validation
                                               |
                         host-owned prompt -> 64-hex auth token
                                               |
                              ws://127.0.0.1:43879/agent
                                               |
                      ready / pong / disconnect (no tool bridge)
                                               |
                            HubUnit.Response -> OMU Log/EHU
                                               |
                              sanitized state back to iframe
```

Object: `PluginLocalAgent.<providerId>` (normalized ID), black box
with EHU/Log, Request[ pair,ping,disconnect,status ],
Response, UserAPI, AgentAPI=[], Property=[], Program. Registered in
URU only while approved plugin UI is installed; removed on uninstall.

Property: `PluginLocalAgentPolicy` pure immutable validation helper
and protocol constants, NOT a second global EDPMU property.

Relation Code: host UI -> LocalAgent Object is Request 10 only
after runtime network grant. No iframe -> OS route. Response 01
back through HubUnit. Shell, filesystem and MCP remain 00.

## EHU acceptance matrix
| Outcome | Expected |
| --- | --- |
| No permission | 403 EHU, no socket |
| Invalid token | 400 EHU, no socket |
| User cancelled prompt | 403 EHU, no socket |
| Auth ready | 200 Log, connected |
| Auth timeout | 504 EHU, disconnected |
| Invalid/unrequested tool_call | 403 EHU, socket closed |
| Ping pong | 200 Log |
| Ping timeout | 504 EHU |
| Revoked capability | 403 EHU on next request |
| Disable/uninstall | socket closed, URU object removed on uninstall |

## Security boundaries
WebSocket is created only in trusted host context and pinned to
127.0.0.1:43879/agent. Server Origin and token authentication are
separate enforcement. Plugin never receives token or arbitrary URL.
Do not move bearer tokens into Hub Request, Worker or runtime Property.

## EventChain and parallelism
Pairing/ping/disconnect are serialized for the same target by existing
HubUnit scheduler. Unrelated provider requests remain parallel.
UI frame events cannot invoke privileged actions outside declared
pair/ping/disconnect, and tool_call is explicitly rejected.
