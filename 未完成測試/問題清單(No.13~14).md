# 未完成測試／問題清單 (No.13~14)

Status: OPEN — PR8 Patch(+13) and Patch(+14) are NOT PASS.

| No. | Severity | Item | Acceptance |
| --- | --- | --- | --- |
| 13.1 | High | Patch13 Node + OCDA Hub/VTE relation tests | Run npm run check, inspect EHU/Log/Dependency; all PASS |
| 13.2 | High | Patch13 line/byte geometry edge cases | Verify UTF-8, CRLF, EOF, invalid and wide ranges |
| 14.1 | High | Patch14 browser regression | Chrome/Edge file open, scroll, zoom, tab change, dirty edits, save |
| 14.2 | High | Dirty data preservation | Edits and unsaved recovery unchanged; no shadow overwrite |
| 14.3 | High | Async scroll race | Rapid scroll and file switching do not leave a stale observed ID |
| 14.4 | High | Full repository test suite and E2E | npm run check and npm run test:e2e PASS |
| 14.5 | High | CI status | PR13 and PR14 verified green; currently no workflow runs returned |
| 14.6 | Medium | Memory/latency measurement | Compare shadow observer on/off at 1/16/64 MiB; no stutter regression |
| 14.7 | High | Real virtual editor integration | Pending Patch15+, not claimed complete |
| 14.8 | High | Piece Tree/MVCC/Writeback/Recovery | Pending Patch15+, never evict unsaved edits |

## Note
The 80ms browser observer is read-only and does not remove the legacy
full-buffer FileDocument. All results above must stay OPEN until actual
test evidence is attached. Rollback: retain main SHA
`34a2804882e55df7aa90892e13f31d7b74d45ce4`.
