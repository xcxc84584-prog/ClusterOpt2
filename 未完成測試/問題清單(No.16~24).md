# PR8 未完成測試與問題清單 No.16–24

Status: OPEN — do not interpret implementation as accepted PASS.

| No. | Severity | Verification target |
| --- | --- | --- |
| 16.1 | P0 | PR16 node tests and npm run check (CI) |
| 16.2 | P0 | HubUnit/VTE EHU and dependency EventChains |
| 16.3 | P0 | Real IndexedDB refresh/reopen E2E added; latest CI pending |
| 16.4 | P0 | Failed write/quota does not publish candidate root |
| 16.5 | P0 | Cross-tab atomic CAS and E2E test added; latest CI pending |
| 16.6 | P0 | Broken/corrupt snapshot returns EHU 422 |
| 16.7 | P1 | Unicode and maximum-size snapshot memory profiling |
| 16.8 | P0 | Full browser E2E baseline and unsupported API 403 |
| 17.1 | P0 | Real file writeback and transactionally safe replace |
| 18.1 | P0 | Piece Tree / B+ integrated into live editor |
| 19.1 | P0 | Virtual editor only loads/paints visible slices |
| 20.1 | P1 | Parallel per-slice Hub scheduling and race cancellation |
| 21.1 | P1 | Executable text-highlighter plugin sandbox |
| 22.1 | P1 | SliceProcessor and EditCommitter plugin stages |
| 23.1 | P0 | Crash/reload recovery across all six layers |
| 24.1 | P0 | 1 GiB / 5 GiB perf, UI, security and PR8 acceptance |

## Required evidence
Link exact CI runs, browser/VTE failure-case logs and test artifacts
before marking any row PASS. No silent data loss or full-buffer fallback
for the eventual virtual editor. Use last safe main before merging PR16.
