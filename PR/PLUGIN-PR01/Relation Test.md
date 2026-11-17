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
## Exact-head CI Evidence — Patch1
Commit `5417677e1bd5894bc349c548a0b6309891b15ebc`:
- [Plugin PR01 OCDA Baseline](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44016589321): PASS, inventory CLI + artifact upload.
- [PR1 OCDA Verification](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44016589313): PASS, Node check + Playwright Chromium E2E.
- [OCDA CI](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44016589229): PASS, unit + browser.
- [Local Agent PowerShell Parse](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44016589294): PASS, PS5.1/7 and Windows ConPTY test.

**注意：上述只適用 Patch1 SHA。Patch2 要重跑 exact-head CI 後才可更新驗收。** 原先 `NOT RUN` 的 5 GiB、實體使用者權限與長時穩定性，不能因其他 CI PASS 變成 PASS。
