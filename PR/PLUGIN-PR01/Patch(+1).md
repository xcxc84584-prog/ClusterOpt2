# PLUGIN PR01 — Patch(+1)
新增：`Implementation/tools/ocda-baseline.mjs` 靜態 Object/Property/REQ/Import 清單；`Implementation/tests/ocda-baseline.test.js` 單元測試；`.github/workflows/plugin-pr01-baseline.yml` CI 輸出 JSON/Markdown artifact；PRD/Plan/ArcD/Relation Test/交接文件。
原因：PR02 的 Catalog 需要可追溯的實際來源，避免直接修改 HubUnit。
不改：UI、正式編輯/存儲、LinkCore、全域 Property、SystemVersion。
本地合成 fixture：2/2 PASS。GitHub full check、VTE、Playwright、瀏覽器權限、大檔、Windows 真機：未完成，**不能當作 PASS**。
還原：`backup/pre-plugin-pr01-20261117` / `96c469ce1f04e9632f767d1762fd2186a13cd0ba`。未合併時關閉 PR 不影響 main；合併後需審查後 revert。