# PR6 pending tests and issues (No.29–36)
| No. | Status | Topic |
| --- | --- | --- |
| 29 | Await CI | Explorer list/filter/activate relation tests |
| 30 | Await browser CI | Sidebar reflects new/open/close/switch |
| 31 | Pending | Import folder and nested directory model |
| 32 | Pending | Reload restore editor tabs and Explorer tree |
| 33 | Pending | Restore browsing scroll (not just cursor) |
| 34 | Pending | IndexedDB permissions, quota and recovery |
| 35 | Pending | Locale, palette and responsiveness regression |
| 36 | Pending | Backup restore gate before main merge |

PR6 Patch(+3): Original Explorer UI shell applied; native folder
picker is wired but folder tree traversal/persistence is still pending.

Patch(+4): directory hierarchy and collapse implemented in memory.
Pending: IndexedDB root restoration, file activation from folder tree,
external CRUD refresh and browsing scroll recovery.

Patch(+5): one Explorer tree with file-handle identity deduplication,
and folder-file activation. Pending durable recovery and PR7 features.

Patch(+6): IndexedDB session restore implemented; browser reload,
permissions, quota, and large-file failure injection still need E2E.

Patch(+7): nested expansion, panel/search/tree-scroll restore,
and expanded-only external CRUD polling. Pending browser permission tests.

Patch(+8): Chromium automated reload regression added. Browser
permissions and large quota failures remain separate acceptance gates.

Patch(+9): Chromium reload test revealed missing restorable IndexedDB
snapshot; added text-only sessionStorage fallback. Require green E2E.

Patch(+10) waits for both durable markers before Chromium reload.

Patch(+11): legacy selected-row and search styling, inline right-click
toolbar added. Rename/create/copy/cut/paste/delete remain disabled;
must implement safely via HubUnit for complete legacy parity.
