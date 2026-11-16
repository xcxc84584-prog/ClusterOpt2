# PR8 Pending tests / issues No.19–23

Status: OPEN until CI and browser/VTE validation.

| Test | Priority | Description |
| --- | --- | --- |
| 19.1 | P0 | PASS: final PR21 Node/OCDA CI, EHU and Relation tests |
| 19.2 | P0 | PASS: Chromium OPFS 65MiB bounded editor edits |
| 19.3 | P0 | PASS: LF/CRLF Chinese global line tests |
| 19.4 | P0 | PASS: Chinese/emoji PieceTree tests |
| 19.5 | P0 | PASS: journal-first edit Node tests |
| 19.6 | P0 | PASS: quota-failure rollback/EHU test |
| 19.7 | P0 | PASS: Node/Chromium dirty navigation; cross-tab manual check pending |
| 19.8 | P0 | PASS: Node and Chromium OPFS byte readback/retire |
| 19.9 | P0 | PASS: Node snapshot rebind; manual crash/reload verification pending |
| 19.10 | P0 | PASS: source hash mismatch tests; external OS race pending |
| 19.11 | P0 | Real externally selected file permission tests |
| 19.12 | P0 | End-to-end 1GiB / 5GiB editing and save |
| 20.1 | P1 | Fast continuous scroll and cancelable parallel loads |
| 20.2 | P1 | Incremental line-prefix indexes with remote jumps |
| 20.3 | P0 | Cross-page edits with multi-slice MVCC |
| 23.1 | P0 | Full crash/power-loss recovery and corrupted journal |
| 23.2 | P0 | Multi-tab file identity and external write races |

PR8 full acceptance NOT PASS. Avoid reporting incremental
browser edit as a complete gigabyte editor or full crash recovery.
