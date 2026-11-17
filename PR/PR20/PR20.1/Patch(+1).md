# PR20.1 Patch(+1)

- `Implementation/plugins/ai-agent-mcp/index.html` 移除聊天表單、prompt submit 綁定並新增唯讀說明。
- `Implementation/plugins/ai-agent-mcp/locales/{zh-Hant,en}.json` 更新唯讀文案，移除過期 prompt/submit。
- `Implementation/plugins/ai-agent-mcp/README.md` 更新功能範圍。
- Playwright 測試改為驗證無輸入框。
- 核心代碼修改：0。
- 證據：GitHub CI 待檢查；Windows Agent、ChatGPT OAuth、CRUD 與 PS 真實環境待驗收。
