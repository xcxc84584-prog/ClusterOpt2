# PLUGIN PR01 — Patch(+2)
## Issue
原來的靜態稽核工具已有 fixture 測試，但缺少 **真實 ClusterOpt2 倉庫作為輸入的 integration regression**；因此無法證明其能在實際 GitHub Actions 倉庫中得到可用資料。

## Change
- `Implementation/tests/ocda-baseline.test.js` 加入實際倉庫整合案例，查驗 HubUnit、Workspace、VirtualFileDocument、Import Edge、Missing Imports。
- 更新 PRD/Plan/ArcD/Relation Test，加入「每個小 PR 必須為完整、可執行、可提交版本」約束。
- PR01 不改動正式文件載入、編輯、存儲、Hub 路由與 UI；版本仍 `0.0.9-pr9.patch9`。

## Acceptance
在 Patch2 SHA 的 GitHub Actions 上，`node --test Implementation/tests/ocda-baseline.test.js`、`npm run check`、`npm run test:e2e` 必須 PASS。Windows 與其他 CI 需核實最新 head。若失敗，修補後重跑而不是合併。真實 1GiB/5GiB 使用者檔案測量與人工授權，不在本次只讀工具產生的證據範圍，繼續標記 NOT RUN。

## Rollback
`backup/pre-plugin-pr01-20261117` / `96c469ce1f04e9632f767d1762fd2186a13cd0ba`。
