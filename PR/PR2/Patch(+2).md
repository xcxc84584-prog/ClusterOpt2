# PR2 Patch(+2) — CI regression, legacy endpoint and input handling

## 發現問題
- 舊版 PR1 單元測試以為 UI_COLOR 必須手動註冊；PR2 已將其設為
  LinkCore 開機即註冊的全域 Property，因此原測試收到 409。
- 原先純黑衍生色與舊 ClusterOpt 使用的黑色介面端點存在小差異。
- 無效的 RGB 輸入雖已透過 EHU 拒絕，畫面中的數值可能暫時殘留。

## 修正
1. 將 LinkCore 回歸測試改為驗證共用 UI_COLOR 已存在且可更新。
2. 明確保留舊版 ClusterOpt 黑色端點的 14 個 CSS token。
3. 無效 RGB 發送 400/EHU 後經 HubUnit 讀回最後合法狀態，還原 UI。
4. 移除 Palette Object 直接對外 callback，避免繞過標準 Request 路由。
5. 增補 Node 與 Chromium 測試，驗證原始黑色端點及輸入回復行為。

## 資訊安全與效能
- 無新金鑰、無絕對路徑、無外部網路傳輸。
- RGB 更新在物件鍵上 FIFO 排程，允許其他物件併行工作。
- UI 顏色計算時間與 14 個 CSS token 數量成正比，負荷很低。

## 驗收
實際 PASS/FAIL 以最新 GitHub Actions 執行結果為準。
瀏覽器真實 UI 視覺仍需手動比對（不可用單元測試宣稱完成）。
