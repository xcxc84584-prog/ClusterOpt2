# PLUGIN PR01 — Plan
## 開工前必讀
`PR/PR9/總工作交接提示詞(v0.0.9-PR9-Patch9).md`、`全域屬性清單.md`、PR9 Plan/ArcD/Patch9、未完成測試問題清單。現行版本 0.0.9-pr9.patch9；PR9 的真實 Windows 權限驗收不得被 CI 認定取代。

## 外部 GitHub 架構參考與改良
- https://github.com/microsoft/monaco-editor ： Model/URI 與 Editor View 分離，Providers 與資料來源解耦；PR01 不移植 Monaco。
- https://github.com/microsoft/vscode-docs/blob/main/api/references/activation-events.md ：宣告式啟動/停用與資源清理；Worker 不等於安全沙箱。
- https://github.com/actions/setup-node ：以固定 Node 版本建立可重現測試流程；CI 不等於真機大檔驗收。

## 架構改良決策
1. 用唯讀原始碼掃描器取代人工複製的第二份 API 清單。
2. Object 身分、Service、Provider、Route 分離；PR02 後才實作 Catalog，PR04 後才允許改路由。
3. L1 虛擬化、L2 切片載入、L3 處理、L4 編輯視窗、L5 MVCC、L6 回寫、S 共享恢復。LinkCore 橫跨各層。
4. Production 的 `FileWorkspace/VirtualFileDocument/HubUnit` 不在 PR01 修改。
5. 區分 PASS、FAIL、SKIP、NOT RUN；純靜態分析不能證明 Relation/VTE PASS。

## OCDA 強制準則
PRD → Plan → ArcD → Implementation + Relation Test → Project。Object 黑箱（EHU/Log/Request/Response/UserAPI/AgentAPI/Property/Program）；HubUnit 是 REQ/REP/Property 通訊入口；URU 登記、EDPMU 共用 Property、OMU EHU/Log/Dependency/VTE。Relation 00/10/01/11、Public/Protected/Private、完整 SubObject 路徑。需分析 EventChain 可並行性；單文件 Save / MVCC 有序。物件與屬性獨立檔、格式一致、不得放硬編碼絕對路徑或金鑰、不得把開發提示放到 UI。

## 資安、負荷、效能
- File System Access 權限可能重啟失效；IndexedDB Quota/Journal 未完成回復必須保留；source fingerprint 存在同大小同時間偵測盲點。
- 靜態掃描複雜度為 O(來源碼位元組 + 邊數)，無寫檔動作，輸出到 stdout；只掃部分字面語法，動態 target 仍需 VTE。
- 大檔量測矩陣：1MiB/64MiB/1GiB/5GiB 的開啟、編輯、儲存、重載、峰值 heap、p95 全部 NOT RUN，不得宣稱改善。

## 合併門禁
一個大 PR 合併一次。需備份分支、正確版本化交接、Relation Test、CI 與適用瀏覽器驗收，未確認時保持 PR 開啟；不得直接推 main。
## Patch(+2) — 參考工程與完整交付策略
實作前再次參考 GitHub 原始碼：
- [Monaco Editor](https://github.com/microsoft/monaco-editor)：Editor 視圖與 Document Model 分離，適合未來 Service/Provider 解耦；PR01 僅稽核、不替換 Editor。
- [VS Code extension service](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensions.ts)：以宣告式服務/生命週期組織擴展，未來 Provider 切換需原子更新且保護正在處理的 REP。
- [Eclipse Theia plugin-ext](https://github.com/eclipse-theia/theia/tree/master/packages/plugin-ext)：插件宿主與外部能力邊界分離，強調 webview 隔離與來源信任；此 PR 不允許不受信任的 Javascript 加入 HubUnit。

完成一個小 PR 的標準：執行期功能不是空殼；附 Node/Browser 或適當真實環境測試；通過 CI；可隨時用備份 SHA 還原；更新 Plan/ArcD/Patch/交接。若測試僅適用特定硬體，需標為 BLOCKED/NOT RUN，不得虛報 PASS。
Patch2 將 CLI 測試擴大為**真實倉庫整合測試**（非只對 synthetic fixture）：要求能掃描 LinkCore、Workspace、VirtualFileDocument 與真實 import 邊，嚴格檢查無缺失相對匯入。

## Patch(+3) 實作前 GitHub 參考與架構改善
- [VS Code Extension Service](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensions.ts)：將 Extension Host 的服務責任與編輯 UI 分離；PR01 不讓第三方程式直接取得 HubUnit。
- [Eclipse Theia plugin-ext](https://github.com/eclipse-theia/theia/tree/master/packages/plugin-ext)：外掛執行與宿主責任分離；安全界線先作為未來插件建設的驗收門檻。
- 現有 ClusterOpt2 `Implementation/tests/ocda.test.js` / `scheduler.test.js` 已測單個路由、權限與排程。新增 **real LinkCore + VTE integration audit** 而不建立第二套 Hub。
- 不讓 Static scan 推測出的 dependencies 冒充執行期 dependencies；實際通過 Node 的 HubUnit 才能產生 REQ/REP 的事件證據。
- 成功路由相對來源觀測代碼為 10；回應由目標返回來源的反向邊為 01。Relation Code 是觀測矩陣，**不是使用權限證明**。

### 驗收證據分層
A：真實 Node LinkCore 路由、EHU、VTE；B：Chromium Playwright；C：Windows runner native ConPTY；D：真實桌面 File System Access 互動與 1–5 GiB 實際負荷。只有 A/B/C 在本大 PR 建立可重現證據，D 保留為未經驗證的已知限制，後續 L1/L2/L6 PR 負責效能與權限硬體驗收。

## Patch(+4) — GitHub implementation study / OCDA refinement
Reviewed [VS Code extension service](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensions.ts) and [Theia plugin-ext](https://github.com/eclipse-theia/theia/tree/master/packages/plugin-ext): extension boundaries depend on explicit contracts and lifecycle, not wildcard routing. Audit tooling therefore executes **real HubUnit rules** and refuses to treat static code relationships as permissions.

Node runtime audit now covers 200 / 400 / 403 / 404 / 409 / 423 with real URU registration, Hub request scheduling, EHU, OMU Dependency, and isolated VTE. It does not mutate production HubUnit or alter version. Final merged PR requires CI on **exact final commit**, plus disclosure of manual browser prompts and 1GiB/5GiB testing limitations. Existing 65MiB OPFS E2E covers bounded pages but not a 5GiB real-machine acceptance.

## Patch(+5) — GitHub 參考、巢狀回應正確性
檢視 VS Code [extension service](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/extensions/common/extensions.ts) 的工作階段結果與控制界線，避免將巢狀動作的外層成功與內層失敗混為一談。OCDA 的 Runtime Audit 在返回 outer 200 時仍應突出 inner EHU 423。這次只調整稽核結果投影，不更改 HubUnit 的執行或錯誤傳遞語義。
