# PLUGIN PR01 Patch(+3)
## 修補問題
Patch2 的真實倉庫稽核仍是靜態來源偵測，不能提供 LinkCore 的實際 REQ/REP/EHU/Relation 運行證據。

## 程式變更
新增 `Implementation/tools/ocda-runtime-audit.mjs`：在正式 `LinkCore` 類別的**獨立記憶體實體**中註冊嚴格 OCDA Object，實際測 UserAPI 成功回應、AgentAPI/Private 授權拒絕、未註冊 sender/receiver 404、OMU EHU 保留與雙向觀測邊 10/01。再使用獨立 `VirtualTestEnvironment` 驗證 VTE 不干預稽核核心。支援直接 Node 執行輸出 JSON。
新增 `Implementation/tests/ocda-runtime-audit.test.js`，更新 GitHub workflow 產生 `runtime.json` artifact。
維持 HubUnit、FileWorkspace、VirtualFileDocument、UI/Save 及 SystemVersion 不變。

## Relation / EHU
成功 200，權限失敗 403，未註冊來源/目標 404；REQ=10、REP=01 分別驗證；OMU 記錄實際事件。需 GitHub exact-head PASS 才能正式驗收。

## 風險與復原
未測真實檔案授權、5GiB 寫入、Windows 使用者持久授權，標記 NOT RUN。回復分支 `backup/pre-plugin-pr01-20261117`。
