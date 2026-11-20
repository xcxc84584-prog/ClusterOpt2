# PR24.01–100 — Independent Acceptance Matrix

This is an **evidence index**, NOT a declaration that 100 subPRs
have passed. Source of intended requirements:
`PR/PR24/Remaining-Requirements.md`.

Branch: `feature/pr24-bidirectional-plugin-sdk`.
PR: https://github.com/xcxc84584-prog/ClusterOpt2/pull/80

## Criteria for PASS
A subPR can only be marked **PASS** when its requirements are
independently mapped to source, positive/negative tests and (where
applicable) a real Worker/browser/VTE regression, the exact-HEAD CI
suite is green, lifecycle/ACL/event chain review is complete, and
the rollback node is recorded. A source file alone is *not* PASS.

All rows below are **pending individual acceptance** even if an
implementation foundation or an E2E exists. The last column gives
starting evidence, not a completeness certification.

| SubPR | Requirement | Planning state | Priority | Evidence / next gap |
| --- | --- | --- | --- | --- |
| PR24.01 | 全面匯出實際對外 API、Object 與 Property | 部分 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.02 | API 目錄與原始程式註冊項差異比對 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.03 | 標定 Public/Protected/Private 及呼叫者 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.04 | 為每一 Action 補齊 Request/Response Schema | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.05 | 列出每一路由的版本及錯誤碼 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.06 | 盤點全部 UICO 原生 UI ID／UISP 欄位 | 部分 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.07 | 盤點 Worker／UI iframe 的 message kinds | 部分 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.08 | 雙向 RPC 契約的版本相容矩陣 | 部分 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.09 | 對外介面權限／資料流／EventChain 審核 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.10 | 發布第三方可讀的 API Catalog 與契約文件 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.11 | MessagePort 與 Provider/Object 身分綁定 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.12 | Challenge/ACK Session 建立及驗證 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.13 | Session ID 唯一性與不可由插件指定 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.14 | Replay window、過期與濫用界限 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.15 | 惡意/異常 Envelope 與外來 Port 測試 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.16 | 同 Provider 多 Port／多 Worker 並行測試 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.17 | Session 中斷／重建後 request correlation | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.18 | iframe／Worker Crash 後 listener 和資源回收 | 部分 | P0 | Implementation/e2e/pr24-upgrade-safety.spec.js |
| PR24.19 | 多 Session 升級切換不交叉授權 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.20 | 滲透測試：偽裝 caller、重放、跨 Session 注入 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.21 | Plugin→Host Request/Response 真實 Port 通路 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.22 | Host→Plugin Controller 接入正式雙向協議 | 部分 | P0 | Implementation/LinkCore/PluginSandboxBridge.js; Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.23 | Host→Plugin 多筆並發 correlation 與回應驗證 | 部分 | P0 | Implementation/LinkCore/PluginBidirectionalRPCController.js; Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.24 | Plugin→Plugin 完整通路與相依服務解析 | 待做 | P0 | Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.25 | 雙方向 Cancel/AbortSignal 傳遞驗證 | 部分 | P0 | Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.26 | Deadline 504、取消 499、過載 429 標準化 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.27 | 同一 Request 去重、超時與 late response 競態 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.28 | 公平排程、巢狀請求及循環等待防護 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.29 | Worker 失聯時雙方向 pending settle | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.30 | 連續大量 RPC 的負載／可恢復測試 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.31 | 反向請求必經 HubUnit，不允許直接 Host API | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.32 | URU 即時 Provider 狀態和 disabled 檢查 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.33 | OMU Request/Response/EHU eventId 追溯 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.34 | parentEventId 與跨物件完整事件鏈 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.35 | 跨兩個第三方 Provider 的實際服務呼叫 | 待做 | P0 | Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.36 | EDPMU Property.Read 公開與私有權限測試 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.37 | Property 其他合法操作的公開契約與權限設計 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.38 | 動態 Provider 註冊／卸載後 Catalog 一致性 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.39 | 高並發及失敗下 OMU/Dependency 紀錄完整性 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.40 | 所有跨物件 EventChain 的 VTE/CI 回歸 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.41 | Manifest 精確 rpcScopes 宣告驗證 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.42 | 安裝／升級時明確顯示並審核 RPC 權限 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.43 | Object/Action/Property 三層授權與拒絕 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.44 | 單一路由即時撤權與 pending 403 回覆 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.45 | 撤權後晚到資料不得洩漏 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.46 | 跨重新整理的持久化撤權（不得自動恢復） | 部分 | P0 | Implementation/e2e/pr24-persisted-revocation.spec.js |
| PR24.47 | 儲存、匯入、升級的重新同意／差異審核 | 部分 | P0 | Implementation/tests/pr24-rpc-revocation-persistence.test.js; Implementation/main/plugin-manager-ui.js |
| PR24.48 | 多 Port／多 Worker 同步撤權與競態 | 待做 | P0 | Implementation/e2e/pr24-persisted-revocation.spec.js |
| PR24.49 | 權限範圍縮減、版本改動及重新核准流程 | 待做 | P0 | Implementation/LinkCore/PluginHostInstallUnit.js |
| PR24.50 | 完整 Capability Matrix 與正反向繞過測試 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.51 | 版本化 SDK 介面與套件格式定案 | 待做 | P0 | Implementation/sdk/README.md |
| PR24.52 | 純第三方環境可用的 request facade | 部分 | P0 | Implementation/sdk/examples/delegate/worker.js |
| PR24.53 | Host→Plugin handler/listener 公開 SDK | 待做 | P0 | Implementation/LinkCore/PluginWorkerSource.js; Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.54 | 型別定義（TypeScript/JSDoc）與範型 Schema | 待做 | P1 | Implementation/sdk/cluster-plugin-sdk.d.ts |
| PR24.55 | SDK 統一錯誤型別／重試與 Deadline | 待做 | P0 | Implementation/LinkCore/PluginWorkerSource.js |
| PR24.56 | SDK 的 Session ready、取消與重連事件 | 部分 | P0 | Implementation/sdk/examples/delegate/worker.js |
| PR24.57 | SDK 的 Provider discovery／capability 查詢 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.58 | SDK Plugin→Plugin service 呼叫範例 | 待做 | P0 | Implementation/sdk/examples/echo/; Implementation/sdk/examples/delegate/ |
| PR24.59 | SDK 相容性與版本升級／舊插件回歸 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.60 | 無需修改核心的外部插件 SDK conformance test | 待做 | P0 | Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.61 | UICO／UISP 對外元件與屬性能力表 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.62 | 插件建立自有 Button/Menu/Tab，無核心改碼 | 部分 | P0 | Implementation/LinkCore/PluginUIHostUnit.js |
| PR24.63 | 插件自訂帶多 Tab 的設定視窗 | 部分 | P0 | Implementation/sdk/examples/echo/index.html |
| PR24.64 | 插件隔離頁面（iframe）與主頁導覽 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.65 | 跨 Plugin Window／Tab 命名與生命週期 | 待做 | P0 | Implementation/LinkCore/PluginWorkbenchTabUnit.js |
| PR24.66 | UI 擴充 API CRUD、原生不可刪除權限 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.67 | UI 座標、大小、樣式、色系的 UISP 行為驗證 | 部分 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.68 | 深／淺色和縮放／行動端相容性 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.69 | 卸載／Crash 後 UI 節點、事件與樣式完全清除 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.70 | 真實外部 UI Plugin 的瀏覽器 E2E 及權限隔離 | 待做 | P0 | Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.71 | 完整多檔 Folder/Asset 驗證與路徑安全 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.72 | 本地選檔→檢查→使用者同意→裝載 | 基礎已實作 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.73 | 停用／啟用／卸載對 Session 及 UI 的清理 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.74 | 成功升級後 Provider/Scope/Session 切換 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.75 | 失敗升級：舊 Worker／Provider／Scope 完整回滾 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.76 | 有 pending 反向 RPC 時的升級拒絕／安全切換 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.77 | 升級失敗後重建 Session 與 UI 狀態 E2E | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.78 | 跨重新載入恢復插件與授權（預設不得升權） | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.79 | 依賴 Provider 的升級／替代服務切換 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.80 | 可還原備份、套件遷移、版本回退驗收 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.81 | 每插件 RPC inflight/queue 及公平分配 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.82 | 超時無回應 Host 對排程佔用的熔斷策略 | 待做 | P0 | Implementation/tests/pr24-messageport-integration.test.js |
| PR24.83 | Worker CPU 占用／強制終止與防卡主頁 | 部分 | P0 | Implementation/e2e/pr24-upgrade-safety.spec.js |
| PR24.84 | Memory/Message/Asset/Log 大小與壽命配額 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.85 | 插件重啟速率、失敗退避及隔離熔斷 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.86 | 來源不可信資料／CSP／Sandbox 對抗驗證 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.87 | 取消、撤權、超時交錯時不留 listener/timer | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.88 | RPC p50/p95 latency、吞吐量、Token 負荷基線 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.89 | 大檔／多插件／低效能設備壓力測試 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.90 | 資源監測及安全警告可用性／UI 整合 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.91 | 至少兩個完全第三方的可安裝插件範例 | 待做 | P0 | Implementation/sdk/examples/echo/; Implementation/sdk/examples/delegate/ |
| PR24.92 | SDK README、Manifest 範本和完整範例 | 待做 | P1 | Implementation/sdk/README.md |
| PR24.93 | 多插件呼叫與獨立 UI E2E | 待做 | P0 | Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.94 | VTE 模擬註冊／撤權／回滾／故障全流程 | 部分 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.95 | CI 加入 SDK conformance、壓力及安全負測試 | 部分 | P0 | Implementation/e2e/pr24-sdk-third-party.spec.js |
| PR24.96 | 跨瀏覽器／縮放／Storage 權限失敗回歸 | 待做 | P1 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.97 | 安全審核：權限、資料流、資訊洩漏和威脅模型 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.98 | 100 個子 PR 各自建立證據、測試及驗收表 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.99 | GitHub 可回復備份、合併衝突、Release Gate | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |
| PR24.100 | Exact-HEAD 全 CI/VTE PASS + 主分支核准合併 | 待做 | P0 | No PR24-specific proof mapped; inspect source and add VTE/CI |

## Release blockers / evidence shortfalls

- Complete G1 runtime/source API parity, schema and exposure inventory.
- Multiple Provider/Port, cross-tab atomic revocation and cross-device
  consent lifecycle are not formally accepted.
- Host→Plugin protocol fallback remains during bootstrap and full
  cross-version parity is pending.
- Generic native UICO/UISP CRUD and unlimited UI customization are
  **not** proven by the isolated HTML multi-tab sample alone.
- Memory, CPU, fairness, circuit-breaker recovery, large-payload
  and load-testing benchmarks require dedicated acceptance budgets.
- PluginPackageStore, upgrade rollback, independent file export and
  backup/restore validation require real migration tests.
- API docs, security review, two-browser compatibility, latency and
  actual model token consumption benchmarks remain outstanding.
- Do not merge to `main` until every row is individually accepted.

## Next acceptance procedure
1. Run exact HEAD `npm run check` and `npm run test:e2e`.
2. Preserve OCDA tests; fix failures instead of changing assertions.
3. Review `PR/PR24/Plan.md`, `ArcD.md`, and current handoff.
4. For each row, attach an explicit test method and verify a denial
   path plus the relevant lifecycle/rollback state.
5. Update this table **only after** that row meets its definition of PASS.

## Patch(+13) verification evidence additions
- PR24.22/23: `Implementation/tests/pr24-omu-correlated-rpc.test.js`
  and `Implementation/e2e/pr24-sdk-third-party.spec.js`
  now cover four consecutive Host responses in one Session and
  unique OMU Event IDs, correcting the 1-second Log cooldown bug.
- PR24.62/63: `Implementation/object/PluginUIControlAdapter.js`
  resolves the Host-visible toolbar; external native UI E2E
  checks Button visibility, Tab navigation, owner ACL and teardown.
- These are evidence **candidates**, not automatic formal PASS.
  Final exact-HEAD CI, wider compatibility/security review and
  individual acceptance signoff are still mandatory.


## Patch(+14) P0 multi-Session evidence candidates

- PR24.16: `Implementation/tests/pr24-multi-session-vte.test.js`
  creates two Node MessageChannel Workers sharing a Provider and
  proves unique Sessions, independent requests and replay windows.
- PR24.19: old Provider detach + new Gateway/Provider rejects an
  obsolete route; Host gateway cannot be reused by another Provider.
- PR24.20: an otherwise URU-valid foreign Provider receives 403
  on a previously owner-pinned Gateway; OMU records the attempted
  cross-Provider attachment.
- PR24.48: one scope revocation cancels pending requests on two
  real ports with separate typed 403 responses, suppresses late
  payloads, and keeps independent unaffected routes running.
- PR24.39: OMU confirms independent EHU records for cross-Port
  revoke; concurrency/load exhaustion still needs a bigger budget
  benchmark and is **not** fully accepted by this small VTE.

These entries are **candidate evidence** until exact HEAD CI/VTE,
negative security review and per-subPR release signoff. They
must not be marked 100% PASS merely because these tests exist.
