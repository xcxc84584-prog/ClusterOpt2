# PR20.1 — ArcD

## Existing objects
- AIAgentMCP plugin Worker：隔離的唯讀 contract。
- PluginUIHostUnit：既有可信任介面託管層，**不修改**。
- PluginExplorerObject：檔案 CRUD 的本地資料夾權限。
- PluginShellApprovalObject：PowerShell 每次授權。
- PluginMCPReadOnlyObject：MCP 讀取端能力。
- PluginLocalAgentObject：本機 Agent 綁定與橋接。

## Changed property
- 僅更新插件私有 HTML/CSS 視圖和 locales 字串，不新增全域 Property。

## Event chains
1. ChatGPT MCP → HTTPS OAuth gateway → local agent → browser bridge → HubUnit/ToolBox → EHU/Log → read-only result.
2. Plugin mount → UI tab → local agent status → read-only output.
3. PowerShell request → permission check → per-command confirmation → local execution → result; deny → EHU/Log.

## Parallelization
MCP 多筆呼叫由既有 requestId 對應；不可因 UI 狀態共享而將結果錯配。此 PR 無路由排程改動。

## EHU / Failure
未授權或過期權限一律由現有 Host/OMU 產生 EHU；UI 不可繞過錯誤路由。此 PR 只移除提交入口，不聲稱完成全端安全驗收。

## Patch(+2) Connection chain
Quick Setup CMD → revision-pinned PowerShell downloads → Local Agent (43879) + MCP (43880) + optional OAuth (43881) → trusted reverse proxy → ChatGPT.

OAuth token scope `cluster.read` → 5-tool allowlist → MCP gateway → local Agent → authorized browser bridge; unlisted/mutating calls receive JSON-RPC denial before the proxy. Local stdio and local bearer gateway expose 14 contract descriptions, but actual mutation must pass ToolBox capabilities and user approval.

No new EDPMU Property, global version writer, or URU registry introduced. The only host interface extension is a named, reviewed installer download event.

## Patch(+3) capability flow
```text
ChatGPT OAuth(scope=cluster.control)
  -> OAuth scoped token validation (43881)
  -> MCP tool contract and routing (43880)
  -> Local Agent authenticated bridge (43879)
  -> Browser ToolBox explicit grant verification
  -> authorized file CRUD or PowerShell exact-command approval
  -> result and existing OMU EHU/Log
```
The OAuth scope enables requesting an action only; it never grants actual file or shell permissions. Permission revocation at ToolBox denies execution independently of token expiry.

## Patch(+4): EventChain and access matrix
```text
Remote tools/call
→ OAuth scope (read/control)
→ MCP gateway
→ paired Local Agent dispatch
→ HubUnit Request(PluginExplorer / PluginShellApproval)
→ per-operation rights and browser handle permission check
→ file operation OR PS exact command confirmation
→ Log / EHU → tool_result → MCP response
```
Explorer grants: `list/read/readChunk`→read, `create`→create, `update`→update, `delete`→delete. Root query needs selected root, PS UI requires ps enabled, PowerShell command approval additionally requires shell.execute capability and one-time user consent. Response request IDs are preserved. Hub rejection and revoked permission fail closed.
