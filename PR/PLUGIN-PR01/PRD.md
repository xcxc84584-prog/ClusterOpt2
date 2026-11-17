# PLUGIN PR01 — 現況稽核、版本保護與 OCDA 基線
Base SHA: `96c469ce1f04e9632f767d1762fd2186a13cd0ba`.
Rollback: `backup/pre-plugin-pr01-20261117`.
Working branch: `plugin/pr01-ocda-baseline`.
Production version stays `0.0.9-pr9.patch9`.

| 小 PR | 目標 | 狀態 |
| --- | --- | --- |
| PR01.01 | main SHA、還原基準 | 版本與備份分支已建立 |
| PR01.02 | 最新交接、全域屬性、問題清單核對 | 文件已核對 |
| PR01.03 | Object/Property/import/REQ 靜態建圖 | 已實作只讀工具 |
| PR01.04 | 六層＋共用層歸屬圖 | 已整理初步對照 |
| PR01.05 | REQ/REP/UserAPI/AgentAPI 來源清單 | 工具可輸出結構化線索 |
| PR01.06 | EventChain/Relation Code 基線 | 架構規格已整理，VTE 待驗 |
| PR01.07 | CI/VTE/Browser 基線 | CI 工作流程已加，結果待驗 |
| PR01.08 | 1MiB、64MiB、1GiB、5GiB | NOT RUN |
| PR01.09 | 權限/CSP/IndexedDB/金鑰風險 | 風險清單已整理 |
| PR01.10 | Plan、ArcD、Patch、交接 | 已建立文件 |

**Merge Gate:** exact-head CI、VTE、Relation、browser evidence 必須具備；大檔/Windows 沒有量測證據不能標示 PASS。PR01 不修改正式資料處理路徑。