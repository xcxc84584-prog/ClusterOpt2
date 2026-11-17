# PR14.2 ArcD — Manifest / Hub execution graph

## Object diagram
```text
Plugin folder (plugin.json, worker.js, README.md)
  -> PluginFolderPackagePolicy
  -> PluginPackageManifestPolicy + ProviderManifestPolicy
  -> human consent -> PluginHostInstallUnit
  -> PluginSandboxBridge (opaque iframe + dedicated Worker)
  -> HubUnit.register / registerProvider -> URU
  -> HubUnit.request(VTE/UI, AIAgentMCP, action, payload)
  -> HubUnit ACL and PluginPermissionUnit -> Worker action
  -> RouteContractPolicy response gate -> OMU Log/EHU
```

## Object interface
`AIAgentMCP` is created through HostInstallUnit's existing strictOCDA
adapter with EHU, Log, Request[getStatus,describe], Response, UserAPI,
AgentAPI, Property and Program. Its implementation runs as a Worker.
No new parallel registry.

## Provider requests
| Service | Action | Req | Rep |
| --- | --- | --- | --- |
| cluster.ai-agent.status | getStatus | empty object | phase:string, connected:boolean, privileged:boolean |
| cluster.ai-agent.contract | describe | empty object | contractVersion:integer, pluginName:string, capabilities:string[] |

These actions are read-only declarations. `getStatus` returns
`contract-only,false,false`; `describe` returns only implemented
capabilities. No privileged capability is exposed.

## Relation / parallel
`VTE -> AIAgentMCP`: request allowed only after registered Hub ACL
checks; response by same route. Default unrelated object relation 00.
`getStatus` and `describe` are pure independent, parallel-safe.
No serial mutation or EventChain fanout is needed until PR14.4+.

## EHU matrix
| Event | Expected status |
| --- | --- |
| Manifest validated | 200 |
| Invalid path/schema | 400 |
| User consent absent | 403 EHU |
| Registered | 201 Log |
| Authorized request/response | 200 Log |
| Malformed request | 400 EHU |
| Unknown action | 403/404 EHU |
| Sandbox unavailable | 503 EHU |
| Uninstall | 200 Log |

## Data flow
Only package bytes and capability metadata are imported. No model key,
token, local filesystem path, host internal object reference or DOM node
crosses into Worker. Future host adapters require per-call authorization,
scope enforcement and independently tested EHU EventChains.
