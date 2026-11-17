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

## Patch(+2) exact-head CI result
`ca3a1f15621b27f816b1ade654a49590669908c5`:
- [OCDA CI](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44017052165): PASS (unit + Chromium).
- [PR1 OCDA Verification](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44017052055): PASS (unit + Chromium).
- [Local Agent PowerShell Parse](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44017052073): PASS (PS5.1, PS7, native ConPTY).
- [Plugin PR01 OCDA Baseline](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44017052053): PASS (real repo static CLI).
These results do not certify later SHA or manual 5 GiB test.

## Patch(+3) operational Relation Test
`node --test Implementation/tests/ocda-runtime-audit.test.js` must PASS on latest SHA; `node Implementation/tools/ocda-runtime-audit.mjs` emits **real LinkCore OMU REQ/REP/EHU** JSON, not mocked fixture. CI uploads `runtime.json` artifact alongside static JSON/MD. New entries: UserAPI 200, AgentAPI 403, Private 403, unknown target/sender 404, dependency Request=10 Response=01, detached VTE success and isolation. **Latest SHA CI pending until GitHub completes.**

## Patch(+3) exact-head CI results
Commit `117307604e83cf0cd4cf3a50f285f08f44b21f19`:
- [PR01 inventory + Runtime Audit](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44017468003) — PASS
- [PR1 OCDA Verification](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44017468001) — PASS
- [OCDA CI](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44017468027) — PASS
- [Local Agent PowerShell Parse](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44017468007) — PASS

## Patch(+4) additional runtime cases
400 invalid contract, 409 duplicate ID and 423 cyclic wait, including explicit EHU preservation checks. **Pending latest SHA CI**. No assertion of user gesture, 1GiB/5GiB real file performance, or hardware-specific permission success.
