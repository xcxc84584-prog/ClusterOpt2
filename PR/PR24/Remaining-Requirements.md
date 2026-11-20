# PR24 — Reorganized Sub-PR Backlog (v24.10)

> 工作清單重整，不是 100 個已完成或已正式驗收的 GitHub PR。
> 以 PR #80 最新 Patch(+10) 程式與 Plan/ArcD/Interface-Audit 為基準。
> 保留原有 PR24.01–PR24.100 的十大群組；細項名稱和優先級為本次新整理的**提案**，後續可逐項對照舊 PR 文檔確認。

**Source:** https://github.com/xcxc84584-prog/ClusterOpt2/pull/80
**Branch:** `feature/pr24-bidirectional-plugin-sdk` / **State:** Draft, main untouched.

## Status vocabulary
- **基礎已實作**：已有可定位程式碼／測試，但這個子 PR 的完整獨立驗收仍未記錄，不等於 PASS。
- **部分**：已有相關實作或前置能力，但完整對外契約／測試未閉環。
- **待做**：尚無足夠可核實的 PR24 對應交付物（不等於全專案沒有相關功能）。
- **P0**：發布或隔離安全阻斷；**P1**：相容、效能或易用性補強。

## Summary
| Status | Count |
| --- | ---: |
| 部分 | 45 |
| 待做 | 38 |
| 基礎已實作 | 17 |
| **正式逐項驗收 PASS** | **未建立逐項證據；不可宣稱數量** |

## G1 · 外部介面與契約盤點（01–10）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.01 | 全面匯出實際對外 API、Object 與 Property | 部分 | P1 |
| PR24.02 | API 目錄與原始程式註冊項差異比對 | 待做 | P1 |
| PR24.03 | 標定 Public/Protected/Private 及呼叫者 | 部分 | P0 |
| PR24.04 | 為每一 Action 補齊 Request/Response Schema | 待做 | P0 |
| PR24.05 | 列出每一路由的版本及錯誤碼 | 待做 | P1 |
| PR24.06 | 盤點全部 UICO 原生 UI ID／UISP 欄位 | 部分 | P1 |
| PR24.07 | 盤點 Worker／UI iframe 的 message kinds | 部分 | P1 |
| PR24.08 | 雙向 RPC 契約的版本相容矩陣 | 部分 | P1 |
| PR24.09 | 對外介面權限／資料流／EventChain 審核 | 部分 | P0 |
| PR24.10 | 發布第三方可讀的 API Catalog 與契約文件 | 待做 | P1 |

## G2 · Session 與隔離通道（11–20）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.11 | MessagePort 與 Provider/Object 身分綁定 | 基礎已實作 | P0 |
| PR24.12 | Challenge/ACK Session 建立及驗證 | 基礎已實作 | P0 |
| PR24.13 | Session ID 唯一性與不可由插件指定 | 基礎已實作 | P0 |
| PR24.14 | Replay window、過期與濫用界限 | 基礎已實作 | P0 |
| PR24.15 | 惡意/異常 Envelope 與外來 Port 測試 | 基礎已實作 | P0 |
| PR24.16 | 同 Provider 多 Port／多 Worker 並行測試 | 待做 | P0 |
| PR24.17 | Session 中斷／重建後 request correlation | 部分 | P0 |
| PR24.18 | iframe／Worker Crash 後 listener 和資源回收 | 部分 | P0 |
| PR24.19 | 多 Session 升級切換不交叉授權 | 待做 | P0 |
| PR24.20 | 滲透測試：偽裝 caller、重放、跨 Session 注入 | 部分 | P0 |

## G3 · 雙向 RPC、取消及背壓（21–30）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.21 | Plugin→Host Request/Response 真實 Port 通路 | 基礎已實作 | P0 |
| PR24.22 | Host→Plugin Controller 接入正式雙向協議 | 部分 | P0 |
| PR24.23 | Host→Plugin 多筆並發 correlation 與回應驗證 | 部分 | P0 |
| PR24.24 | Plugin→Plugin 完整通路與相依服務解析 | 待做 | P0 |
| PR24.25 | 雙方向 Cancel/AbortSignal 傳遞驗證 | 部分 | P0 |
| PR24.26 | Deadline 504、取消 499、過載 429 標準化 | 基礎已實作 | P0 |
| PR24.27 | 同一 Request 去重、超時與 late response 競態 | 部分 | P0 |
| PR24.28 | 公平排程、巢狀請求及循環等待防護 | 部分 | P0 |
| PR24.29 | Worker 失聯時雙方向 pending settle | 部分 | P0 |
| PR24.30 | 連續大量 RPC 的負載／可恢復測試 | 待做 | P1 |

## G4 · HubUnit／URU／OMU／EDPMU 整合（31–40）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.31 | 反向請求必經 HubUnit，不允許直接 Host API | 基礎已實作 | P0 |
| PR24.32 | URU 即時 Provider 狀態和 disabled 檢查 | 基礎已實作 | P0 |
| PR24.33 | OMU Request/Response/EHU eventId 追溯 | 部分 | P0 |
| PR24.34 | parentEventId 與跨物件完整事件鏈 | 部分 | P0 |
| PR24.35 | 跨兩個第三方 Provider 的實際服務呼叫 | 待做 | P0 |
| PR24.36 | EDPMU Property.Read 公開與私有權限測試 | 部分 | P0 |
| PR24.37 | Property 其他合法操作的公開契約與權限設計 | 待做 | P1 |
| PR24.38 | 動態 Provider 註冊／卸載後 Catalog 一致性 | 部分 | P0 |
| PR24.39 | 高並發及失敗下 OMU/Dependency 紀錄完整性 | 待做 | P0 |
| PR24.40 | 所有跨物件 EventChain 的 VTE/CI 回歸 | 部分 | P0 |

## G5 · 權限／Capability／撤權（41–50）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.41 | Manifest 精確 rpcScopes 宣告驗證 | 基礎已實作 | P0 |
| PR24.42 | 安裝／升級時明確顯示並審核 RPC 權限 | 基礎已實作 | P0 |
| PR24.43 | Object/Action/Property 三層授權與拒絕 | 基礎已實作 | P0 |
| PR24.44 | 單一路由即時撤權與 pending 403 回覆 | 基礎已實作 | P0 |
| PR24.45 | 撤權後晚到資料不得洩漏 | 基礎已實作 | P0 |
| PR24.46 | 跨重新整理的持久化撤權（不得自動恢復） | 部分 | P0 |
| PR24.47 | 儲存、匯入、升級的重新同意／差異審核 | 部分 | P0 |
| PR24.48 | 多 Port／多 Worker 同步撤權與競態 | 待做 | P0 |
| PR24.49 | 權限範圍縮減、版本改動及重新核准流程 | 待做 | P0 |
| PR24.50 | 完整 Capability Matrix 與正反向繞過測試 | 部分 | P0 |

## G6 · 獨立 Plugin SDK（51–60）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.51 | 版本化 SDK 介面與套件格式定案 | 待做 | P0 |
| PR24.52 | 純第三方環境可用的 request facade | 部分 | P0 |
| PR24.53 | Host→Plugin handler/listener 公開 SDK | 待做 | P0 |
| PR24.54 | 型別定義（TypeScript/JSDoc）與範型 Schema | 待做 | P1 |
| PR24.55 | SDK 統一錯誤型別／重試與 Deadline | 待做 | P0 |
| PR24.56 | SDK 的 Session ready、取消與重連事件 | 部分 | P0 |
| PR24.57 | SDK 的 Provider discovery／capability 查詢 | 待做 | P1 |
| PR24.58 | SDK Plugin→Plugin service 呼叫範例 | 待做 | P0 |
| PR24.59 | SDK 相容性與版本升級／舊插件回歸 | 待做 | P0 |
| PR24.60 | 無需修改核心的外部插件 SDK conformance test | 待做 | P0 |

## G7 · 通用 UI／UISP／插件頁面（61–70）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.61 | UICO／UISP 對外元件與屬性能力表 | 部分 | P0 |
| PR24.62 | 插件建立自有 Button/Menu/Tab，無核心改碼 | 部分 | P0 |
| PR24.63 | 插件自訂帶多 Tab 的設定視窗 | 部分 | P0 |
| PR24.64 | 插件隔離頁面（iframe）與主頁導覽 | 基礎已實作 | P0 |
| PR24.65 | 跨 Plugin Window／Tab 命名與生命週期 | 待做 | P0 |
| PR24.66 | UI 擴充 API CRUD、原生不可刪除權限 | 部分 | P0 |
| PR24.67 | UI 座標、大小、樣式、色系的 UISP 行為驗證 | 部分 | P1 |
| PR24.68 | 深／淺色和縮放／行動端相容性 | 待做 | P1 |
| PR24.69 | 卸載／Crash 後 UI 節點、事件與樣式完全清除 | 部分 | P0 |
| PR24.70 | 真實外部 UI Plugin 的瀏覽器 E2E 及權限隔離 | 待做 | P0 |

## G8 · 套件、升級及持久化生命週期（71–80）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.71 | 完整多檔 Folder/Asset 驗證與路徑安全 | 基礎已實作 | P0 |
| PR24.72 | 本地選檔→檢查→使用者同意→裝載 | 基礎已實作 | P0 |
| PR24.73 | 停用／啟用／卸載對 Session 及 UI 的清理 | 部分 | P0 |
| PR24.74 | 成功升級後 Provider/Scope/Session 切換 | 部分 | P0 |
| PR24.75 | 失敗升級：舊 Worker／Provider／Scope 完整回滾 | 部分 | P0 |
| PR24.76 | 有 pending 反向 RPC 時的升級拒絕／安全切換 | 部分 | P0 |
| PR24.77 | 升級失敗後重建 Session 與 UI 狀態 E2E | 部分 | P0 |
| PR24.78 | 跨重新載入恢復插件與授權（預設不得升權） | 部分 | P0 |
| PR24.79 | 依賴 Provider 的升級／替代服務切換 | 部分 | P0 |
| PR24.80 | 可還原備份、套件遷移、版本回退驗收 | 待做 | P0 |

## G9 · 容量限制、隔離及效能（81–90）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.81 | 每插件 RPC inflight/queue 及公平分配 | 部分 | P0 |
| PR24.82 | 超時無回應 Host 對排程佔用的熔斷策略 | 待做 | P0 |
| PR24.83 | Worker CPU 占用／強制終止與防卡主頁 | 部分 | P0 |
| PR24.84 | Memory/Message/Asset/Log 大小與壽命配額 | 部分 | P0 |
| PR24.85 | 插件重啟速率、失敗退避及隔離熔斷 | 待做 | P0 |
| PR24.86 | 來源不可信資料／CSP／Sandbox 對抗驗證 | 部分 | P0 |
| PR24.87 | 取消、撤權、超時交錯時不留 listener/timer | 部分 | P0 |
| PR24.88 | RPC p50/p95 latency、吞吐量、Token 負荷基線 | 待做 | P1 |
| PR24.89 | 大檔／多插件／低效能設備壓力測試 | 待做 | P1 |
| PR24.90 | 資源監測及安全警告可用性／UI 整合 | 待做 | P1 |

## G10 · 第三方驗收、CI、文件及合併（91–100）

| 子 PR | 要求（可獨立完成與驗收） | 現況 | 優先 |
| --- | --- | --- | --- |
| PR24.91 | 至少兩個完全第三方的可安裝插件範例 | 待做 | P0 |
| PR24.92 | SDK README、Manifest 範本和完整範例 | 待做 | P1 |
| PR24.93 | 多插件呼叫與獨立 UI E2E | 待做 | P0 |
| PR24.94 | VTE 模擬註冊／撤權／回滾／故障全流程 | 部分 | P0 |
| PR24.95 | CI 加入 SDK conformance、壓力及安全負測試 | 部分 | P0 |
| PR24.96 | 跨瀏覽器／縮放／Storage 權限失敗回歸 | 待做 | P1 |
| PR24.97 | 安全審核：權限、資料流、資訊洩漏和威脅模型 | 待做 | P0 |
| PR24.98 | 100 個子 PR 各自建立證據、測試及驗收表 | 待做 | P0 |
| PR24.99 | GitHub 可回復備份、合併衝突、Release Gate | 待做 | P0 |
| PR24.100 | Exact-HEAD 全 CI/VTE PASS + 主分支核准合併 | 待做 | P0 |

## Patch(+11) 進度註記（待 exact-HEAD CI 驗收）
- PR24.46：已加入 Host 私有 IndexedDB deny-only 儲存與網頁重載 E2E，待最終 CI。
- PR24.76：已加入 Host→Plugin 和 Plugin→Host 雙方向 upgrade-busy gate，待最終 CI。
- PR24.77：已新增真實 Worker 升級失敗回滾／Session rekey 瀏覽器 E2E，全面 rollback 尚待驗收。
- PR24.47：獨立的已撤權路由「重新授權」UI 尚未實作；**不允許**透過普通 install 自動恢復。
- PR24.75：完整原子性回滾和 side-effect 邊界仍屬部分實作。

## 建議執行順序（不必依編號線性開發）
1. **Phase A / P0**：PR24.46、47、75–78 — 持久化撤權、升級中 pending 請求與回滾，先關閉升權風險。
2. **Phase B / P0**：PR24.22–24、34–35、51–60 — 雙向通路對接和可發布的獨立 SDK，含 Plugin→Plugin 服務。
3. **Phase C / P0**：PR24.61–70 — 一般第三方插件 UI：Tab/Window/Button、owner ACL、動態 UISP。
4. **Phase D / P0**：PR24.81–87 — 單插件併發配額、熔斷、Crash 清理，避免 Host 資源耗盡。
5. **Phase E / Gate**：PR24.91–100 — 第三方真實插件、E2E/VTE/CI、100 項證據、恢復節點，最後才可合併 main。
6. G1–G4 的盤點、協議與事件鏈驗收貫穿 Phase A–E，不能跳過。

## 每一個子 PR 的固定驗收模板
- [ ] 已讀 `全域屬性清單.md` 與上一版 `總工作交接提示詞`。
- [ ] 更新 `Plan.md`：需求、使用情境、資安、資料流量和負荷估算。
- [ ] 更新 `ArcD.md`：Object/Property、Request/Response、Event Chain/EHU。
- [ ] 核心沒有繞過 HubUnit、URU、EDPMU、OMU 的既有權責。
- [ ] Implementation／關聯 Unit Test／反例與負測試齊備。
- [ ] 實際 Worker／MessagePort／第三方插件 Browser E2E（如適用）。
- [ ] VTE 隔離驗證、CI exact-HEAD 全通過，錯誤未被略過。
- [ ] 完成 Patch(+n).md、逐項驗收證據、回滾節點、最新交接。

## 阻擋發布的明確缺口
1. 現有撤權快照只存在 Bridge 記憶體；瀏覽器重載後的授權維護缺少正式持久化契約。
2. Host→Plugin 控制器已有基礎，但完整通用 SDK / 對外 handler 接口尚需接入與型別化。
3. Plugin→Plugin 的端到端可用性與完整授權矩陣尚無足夠的獨立驗收。
4. 真實 Worker 升級失敗／pending 反向請求／Session rekey／UI 回滾仍需真實 E2E。
5. Host 取消不會撤銷已完成的 side effects；不合作物件會繼續佔用 in-flight slot，需要熔斷和資源治理。
6. GitHub CI 綠燈僅表示現有 workflow 測試通過，並不自動證明 100 小項或第三方 SDK 發布門檻均通過。
