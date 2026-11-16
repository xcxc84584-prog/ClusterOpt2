# PR8 未完成測試 / 問題清單 No.18–24

| ID | Priority | Acceptance check |
| --- | --- | --- |
| 18.1 | P0 | CI: lint, Node, OCDA, Chromium tests |
| 18.2 | P0 | 65 MiB+ opens existing textarea without full read |
| 18.3 | P0 | Page Piece Tree/B+ length and UTF-8 boundaries |
| 18.4 | P0 | Partial page Edit/Save returns EHU 409 |
| 18.5 | P0 | Large-file legacy Save guarded even after restore |
| 18.6 | P0 | Recovery restores virtual page from handle, not text |
| 18.7 | P0 | UI wheel/Alt+PageUp/Down page transition |
| 18.8 | P0 | Chrome/Edge zoom, fast page navigation, file change |
| 18.9 | P0 | EHU Log/Relation 10/01 actual VTE cases |
| 18.10 | P0 | Test 1 GiB and 5 GiB real file latency/memory |
| 19.1 | P0 | Editable virtual viewport, no complete document text |
| 19.2 | P0 | Global line indexing, Piece Tree delta and UTF-8 offsets |
| 19.3 | P0 | MVCC+writeback/recovery of editable visible slices |
| 20.1 | P1 | Per-slice parallel tasks, cancellation and eviction |
| 21.1 | P1 | Text highlighter plugin sandbox |
| 22.1 | P1 | Processor and Committer Plugin user programs |
| 23.1 | P0 | Multi-layer crash-safe recovery and final acceptance |

Patch18 is a safe read-only large-file admission bridge.
The complete PR8 virtual editable document remains NOT PASS.
