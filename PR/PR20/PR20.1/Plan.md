# PR20.1 — AI AGENT MCP(ChatGPT) 唯讀 UI

## PRD
以舊版 Cluster AI Agent 介面為參考，插件化提供 ChatGPT MCP 的唯讀操作輸出面板。移除插件內建聊天輸入框，不應讓使用者誤認聊天等同 MCP 呼叫。不得修改主編輯器、HubUnit、URU、OMU、EDPMU 或插件託管核心。

## Scope
- 將 AI Agent 插件的 HTML 表單改為唯讀說明與輸出。
- 移除提交任務的瀏覽器事件綁定，保留既有外部 MCP 與 ToolBox。
- 維持 PowerShell 同級工具分頁、語言與顏色系統。
- 更新既有 Playwright 驗收條件。

## Security and throughput
- 外部 ChatGPT MCP 仍經 OAuth/本地代理、已授權 ToolBox 權限與逐命令 PowerShell 確認。
- 禁止在插件 iframe 存放 Key/Token、直接存取主程式或新增非授權工具。
- 事件輸出維持原有 40 筆、每筆 65536 字元的展示限制；不得將完整大型檔案塞入 UI。
- 本 PR 不擴張授權、不更動 HTTP/MCP gateway 路由或後端協議。

## Acceptance
- UI 不含 textarea、caiForm 或 cluster-model-submit 發送流程。
- 配對與 Quick-Setup 仍可操作；ToolBox 既有授權與撤銷測試不受影響。
- 正式 Windows/OAuth/HTTPS 與 Node agent 的實機測試仍列為外部驗收。

## Patch(+2): legacy MCP configuration and APIs
- Standalone MCP setup CMD offered through the existing trusted host download mechanism; the plugin iframe never navigates to privileged local paths.
- Remote MCP catalogue parity: 14 legacy named tools; stdio now mirrors the same schemas.
- OAuth read-only security fix: `cluster.read` filters `tools/list` and rejects any `tools/call` outside the five-tool allowlist. No `cluster.control` is granted.
- HTTPS termination still user-provided; 43879/43880 are loopback-only.
- Source pins and code audit are necessary; Windows live E2E remains pending.
