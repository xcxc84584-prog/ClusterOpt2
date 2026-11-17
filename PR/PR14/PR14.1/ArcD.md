# PR14.1 ArcD — AI AGENT MCP(ChatGPT) plugin boundary

## Object and Property design (proposed; NOT runtime implementation yet)
Objects: AIAgentPanel, AIAgentSession, AgentLocalBridge, AgentTaskCoordinator, AgentExplorerAdapter, AgentShellAdapter, AgentMCPAdapter, AgentOAuthAdapter.
Properties: AgentLocalization, AgentConnectionPolicy, AgentTaskPolicy, AgentFileCapabilityPolicy, AgentShellApprovalPolicy, AgentMCPContractPolicy.
Every Object interface reserves EHU/Log, Request, Response, User API, Agent API, Property and Program.
Properties own algorithms; Objects own callable interfaces and concurrent orchestration.
Reuse global Language, UI_COLOR, Hub ACL and PluginPermissionPolicy rather than duplicating authorities.

## EventChain
```text
Human click -> Plugin UI entry (sandbox/host-approved extension point)
 -> HubUnit.Request -> URU identity + dependency check
 -> HubUnit Capability ACL -> AgentLocalBridge
 -> authenticated loopback Local Agent -> bounded response
 -> HubUnit.Response -> OMU Log/EHU -> UI output
```

```text
ChatGPT MCP -> OAuth consent + PKCE + token scope
 -> MCP tool contract -> per-tool capability gate
 -> HubUnit.Request -> browser-approved Explorer/shell adapter
 -> HubUnit.Response -> MCP result / EHU
```

## Relation Code
Default 00. UI -> TaskCoordinator 10 after approved capability.
TaskCoordinator -> LocalBridge 10; reply 01; 11 only if both directions explicitly registered.
Explorer and Shell adapters require separate grants. Private provider credential must never become public shared Property.

## Key compatibility gaps
1. Legacy UI directly attaches to workarea/tabList; sandbox forbids untrusted direct host DOM access.
2. Legacy file tools use ClusterCEXP/window handles; target requires explicit Hub adapter and browser File System Access reauthorization.
3. Legacy terminal uses ClusterTerminal and modal approval; target requires host-owned per-command dialog, not plugin-controlled approval.
4. Legacy local agent WebSocket uses 127.0.0.1:43879; target terminal agent uses separate architecture/port and cannot be assumed protocol compatible.
5. Legacy model keys saved in local-agent config on disk; future encrypted/OS-credential backed provider is a separate decision. Never copy/ship keys.
6. Legacy OAuth and browser tool capability sets differ: preserve least privilege and verify actual tool lists.

## Error handling matrix
| Failure | HTTP-like status | OMU |
| --- | --- | --- |
| Absent capability / denied operation | 403 | EHU |
| Unknown Object/action | 404 | EHU |
| Invalid payload/unsafe path | 400 | EHU |
| Existing active task / conflicting write | 409 | EHU |
| Output payload exceeded limit | 413 | EHU |
| Local agent offline | 503 | EHU |
| RPC/task timeout | 504 | EHU |
| Approved normal request | 200 | Log with dedup policy |
| Plugin activated | 201 | Log |

## Parallel scheduling
Independent read-only file/task metadata operations: parallel with bounded fan-out, unique event IDs and propagated cancellation.
Same-file write/delete and shell session commands: serialize; no parallel mutation on same resource.
Provider tasks: explicitly enforced per-session concurrency budget, stop/abort propagation.
Do not weaken default 00 relation gates for throughput.
