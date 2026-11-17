# PR20.1 Patch(+1)

- `Implementation/plugins/ai-agent-mcp/index.html` 移除聊天表單、prompt submit 綁定並新增唯讀說明。
- `Implementation/plugins/ai-agent-mcp/locales/{zh-Hant,en}.json` 更新唯讀文案，移除過期 prompt/submit。
- `Implementation/plugins/ai-agent-mcp/README.md` 更新功能範圍。
- Playwright 測試改為驗證無輸入框。
- 核心代碼修改：0。
- 證據：GitHub CI 待檢查；Windows Agent、ChatGPT OAuth、CRUD 與 PS 真實環境待驗收。

## Patch(+2) — MCP configuration / API parity / OAuth authorization
- Added `MCP-Quick-Setup.cmd` and `MCP-SETUP.md` to the plugin package.
- Added separate host-controlled download event through PluginUIHostUnit and plugin-agent-download. This is a plugin interface repair, not editor business logic.
- Expanded local stdio MCP API from 5 to 14 legacy tool declarations.
- Fixed critical scope mismatch: OAuth `cluster.read` now filters tool list and refuses non-readonly tool calls.
- Updated UI guide, E2E and node contract tests.
- Work remains Draft pending CI, Windows local installation, HTTPS/OAuth tests and actual ToolBox / PS execution.

## Patch(+3) — separate control authorization
- OAuth Gateway scope accepts explicit `cluster.control`, stores it in the authorization code and access token, and offers a control-specific warning at user consent.
- `tools/list` exposes all existing 14 tools only to `cluster.control`; `cluster.read` stays filtered to five.
- `tools/call` denies write/shell tools for `cluster.read`. Actual execution is still enforced by trusted Local Agent and browser ToolBox/PS approval.
- Automated contract coverage updated. Real Windows and OAuth browser security tests remain pending.

## Patch(+4) — complete host route integration
- PluginLocalAgentObject now routes legacy Explorer tools through registered PluginExplorerObject and HubUnit rather than returning Tool access denied.
- PluginExplorerObject adds bounded readChunk and trusted Agent caller authorization with existing ToolBox rights; the old UI origin remains supported.
- PluginUIHostUnit plugin interface associates trusted Agent and Explorer instances on mount.
- Restored legacy response shapes for list_directory, read_path, create_file, write_path and delete_path; blocked cross-root paths and invalid filenames.
- Existing PowerShell tab open action now checks PS ToolBox grant; shell execution still demands per-command approval.
- New tests cover Hub route selection, unauthorized Agent, root isolation and PS permission denial.
- E2E real host gates remain pending; PR stays Draft.
