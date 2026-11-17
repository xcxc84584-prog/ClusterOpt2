# PLUGIN PR01 Patch(+4)
## 目的
補齊執行期稽核結果的 EHU 400/409/423 與 EventChain 循環等待證據，避免宣稱所有 Relation 已驗證卻只測 200/403/404。

## 修改
- Runtime Audit CLI 額外檢查嚴格 OCDA 契約 400、URU 重複 Object ID 409、HubUnit 對環形 REQ 的 423 防護。
- 在 OMU 確認每種失敗 EHU 都存在，並更新 Node 測試的 8 項案例斷言。
- 同步更新 Plan.md、ArcD.md、Relation Test.md、PRD.md、Patch(+4).md 及交接。
- 不更動正式 Object、Property、File System Access、LinkCore 或 User UI。

## 測試與發布
以 GitHub Actions exact-head 的 PR01 專用流程、OCDA/Chromium、Windows PS/ConPTY 結果作為本 Patch 的有效驗收。人工 File System Access 與 1GiB/5GiB 測試仍未完成，列為獨立缺口而非 PASS。

## 復原
原版 `96c469ce1f04e9632f767d1762fd2186a13cd0ba`；分支 `backup/pre-plugin-pr01-20261117`。
