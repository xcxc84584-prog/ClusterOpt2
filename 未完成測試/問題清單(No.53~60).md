# PR8 pending tests and issues — No.53 to No.60

| No. | Status | Risk / acceptance condition |
| --- | --- | --- |
| 53 | CI pending | Verify UTF-8 multibyte line-to-byte lookup, CRLF, sparse jump/backseek, EHU 400/404/409/416 and directed relations |
| 54 | Pending | Bare-CR and mixed platform newline indexing (current LineAddressPolicy indexes LF/CRLF only) |
| 55 | Pending | Connect accurate visible editor line window + page zoom to line address lookup; no proportional file-size guesses |
| 56 | Pending | Optimized far-ahead seek with indexed chunks, generation cancellation and visible progress; avoid unbounded main-thread scanning |
| 57 | Pending | Integrate per-document PieceTree/B+ index with external Blob and accurate byte↔UTF-16 offsets after edits |
| 58 | Pending | Stage 3 highlighter/encoder/line helpers on *full* slices only; preloads bypass plugins |
| 59 | Pending | Stage 5 MVCC and editing undo/redo per virtual slice; atomic writeback and dirty-state demotion only after durable save |
| 60 | Pending | Crash reload of dirty edits and exact viewport, large file + multi-document memory/permission/quota fault injection |

Patch(+12) creates sparse line indexing and exact line/byte
navigation but does not yet replace the production textarea.
No PR8-wide PASS or large-file edit claim may be made until
Nos.55–60 and their VTE/E2E acceptance tests pass.

Patch(+12) extra coverage: clean virtual close + index disposal,
Blob ID reuse, and dirty-close refusal tested through real VTE.
No.59 remains pending because dirty state is deliberately not
released without a durable writeback implementation.
