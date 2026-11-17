# PLUGIN PR01 — Relation Test / Evidence
| Case | Evidence | Result |
| --- | --- | --- |
| Static import/contract/request fixture | local node --test | PASS |
| Missing import detection fixture | local node --test | PASS |
| Exact-head CI inventory artifact | Pending GitHub Actions | NOT RUN |
| npm run check | Pending GitHub Actions | NOT RUN |
| Playwright e2e | Pending GitHub Actions | NOT RUN |
| VTE 200/400/403/404/409/423 | Pending runtime evidence | NOT RUN |
| Real File System Access / crash recovery | Pending Chromium | NOT RUN |
| 1MiB/64MiB/1GiB/5GiB memory and writeback | Pending measurement | NOT RUN |
| Windows Node/ConPTY/PowerShell | Pending real machine | NOT RUN |

**Release decision: HOLD.** Static scanner is not VTE. EHU and FAIL cannot be sampled away. Exact-head check required before PR01 is merged.