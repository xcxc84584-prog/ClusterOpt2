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
