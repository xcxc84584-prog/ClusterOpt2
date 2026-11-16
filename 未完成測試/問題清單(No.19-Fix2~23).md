# PR8 Patch(+19-Fix2) 未完成測試／問題清單

PR8 remains NOT PASS. Do not mark a test complete from an earlier PR.

| ID | Priority | Verification |
| --- | --- | --- |
| 19F2.1 | P0 | Close All saves dirty virtual file before unregister |
| 19F2.2 | P0 | CloseMany/Explorer root uses verified group writeback |
| 19F2.3 | P0 | Any failed batch save keeps all tabs registered |
| 19F2.4 | P0 | Cancel group save leaves dirty text and checkpoint |
| 19F2.5 | P0 | Local FileSystemFileHandle denied permission preserves edit |
| 19F2.6 | P0 | No async delay before legacy Open/SaveAs file picker |
| 19F2.7 | P0 | 65 MiB full file size unchanged after equal-length save |
| 19F2.8 | P0 | Existing PR1 synchronous clean-file close regression |
| 19F2.9 | P0 | Hub Request/Response, OMU EHU and dependencies |
| 19F2.10 | P0 | Both CI workflows green on final PR head |
| 19F2.11 | P0 | Verify pre-merge main backup is identical |
| 19F2.12 | P0 | Local Windows selected-file permission manual acceptance |
| 20.1 | P1 | Parallel slice load and fast scroll performance |
| 23.1 | P0 | 1 GiB/5 GiB IO performance, crash and data recovery |

Use real browser EHU and status diagnostics for unresolved issues.
Do not delete or silently discard a dirty journal on any failed close.
