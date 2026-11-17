# PLUGIN PR01 — Patch(+5)
## 問題
Patch4 的 CI 發現 Node audit 測試 FAIL：外層 HubUnit Request 成功（200），但內層循環等待被拒絕（423）。報告將 200 記錄為檢測項目 status，導致 `report.tests.some(status===423)` 不成立。
## 修正
保留原始 nested Response，對 cycle case 輸出內層 423 作為 `observed status`。不更改生產 LinkCore、HubUnit、FileWorkspace 或 VTE；更新 Plan、ArcD、Relation Test 與版本交接文件。
## 驗收
`npm run check` 與 PR01 runtime audit、Chromium E2E、Windows PS/ConPTY 全部須以最新 commit PASS。CI 未完成不得標整體 PASS。1GiB/5GiB 使用者實測與瀏覽器真實授權不屬於本稽核結果。
