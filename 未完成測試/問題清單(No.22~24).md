# PR8 Patch22–24 open issues / tests

| ID | Priority | Work | State |
| --- | --- | --- | --- |
| 22.1 | P0 | Uniform sliceManifest and Hub EventChain | Test added |
| 22.2 | P0 | Remove legacy full-buffer for all files | OPEN |
| 22.3 | P0 | P-tree/B+ resident slice edit integration | OPEN |
| 22.4 | P0 | Small, empty and UTF-8 Unicode files | OPEN |
| 23.1 | P0 | Viewport owner isolation across documents | Test added |
| 23.2 | P1 | Identical scroll plan avoids repeat Blob reads | Added, benchmark OPEN |
| 23.3 | P0 | Dirty slice retention + memory budget | VTE regression pending |
| 23.4 | P1 | Fast wheel/line jump; Worker concurrency | OPEN |
| 23.5 | P0 | Preload eviction and viewport demotion race | OPEN |
| 24.1 | P0 | CI Node/Chromium/Playwright complete | Pending |
| 24.2 | P0 | Real Windows permissions and file lock tests | OPEN |
| 24.3 | P0 | 1 GiB/5 GiB load/save/recovery | OPEN |
| 24.4 | P0 | Crash recovery + MVCC journal integrity | OPEN |
| 24.5 | P0 | Version rollback and restore simulation | Pending |
| 24.6 | P0 | Full six-stage EventChain acceptance | OPEN |

PR8 remains NOT PASS.

Latest test extension: synthetic 1/5GiB Blob metadata test added.
Real disk benchmarks, Worker parallelism and full slice editor OPEN.

## Patch(+24-Fix1) updated status
- 22.1: implemented; sliceManifest now exposed in Workspace UserAPI.
- 22.2 / 22.3: OPEN — full-buffer small-document authority retained.
- 23.2: implemented cache fast path and bounded batch; true user-wheel
  latency/throughput benchmark remains OPEN.
- 23.3: unit/VTE added, dirty and pinned state protected.
- 23.4: asynchronous I/O concurrency implemented; CPU Worker OPEN.
- 23.5: eviction and duplicate requested preloads covered by new tests.
- 24.3: synthetic 5 GiB byte seek test added; real disk I/O OPEN.
- 24.1 / 24.5: require final HEAD CI and restore SHAs at BC.

## Patch25 additional audit issues
- 25.1 Explorer cut-paste copy verification and cleanup: test added.
- 25.2 Old context toolbar new-file action missing: OPEN.
- 25.3 Folder paste/rename returns 501: OPEN.
- 25.4 Duplicate opened-handle identity under alternate handles:
  REQUIRE browser test; Workspace.open already checks isSameEntry.
- 25.5 Real Windows file permissions/locks: OPEN.
- 25.6 Original styling parity: visual regression OPEN.
PR8 remains NOT PASS.

- 25.2: directory/root right-click new-file action implemented,
  Playwright test added; pending final CI/browser PASS.
