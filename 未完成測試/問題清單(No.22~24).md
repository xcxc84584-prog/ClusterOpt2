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


## Patch25 Fix1 follow-ups
- 25.7 Centralized version after Patch25: corrected by LinkCore.
- 25.8 Missing declared icon request: added local favicon.svg.
- 25.9 Exact browser 404 source URL still UNKNOWN; request URL
  needed if the console message persists after the Pages build.
- 25.10 Verify Pages deployed SHA and cache after CI merge.


## Patch25 Fix2 status
- 25.11: NotAllowedError reconcile loop: guarded and tested.
- 25.12: Matching handle re-selection resumes existing tab: tested.
- 25.13: Browser permission revoke/regain workflow: real browser
  integration / user gesture acceptance still required.
- 25.14: Old Cluster.version() after merge: verify exact
  location.href and uncached resource URL in client.

## Final PR8/PR9 acceptance audit — 2026-11-17
Full matrix: PR/PR8/FinalAcceptance-20261117.md and
PR/PR9/FinalAcceptance-20261117.md.

- PR8 22.2 / 22.3, 23.4, 24.2 / 24.3 / 24.4 / 24.6 and
  25.3 / 25.13 remain OPEN or not independently verified.
- PR9 full global line jump, Explorer parity and Windows native
  PowerShell parity remain OPEN.
- Patch4 addresses PSM version and CMD source mismatch; do not
  equate an exact-head green CI with full system acceptance.

## PR9 Patch6 — PowerShell setup syntax failure (2026-11-17)
Issue: install-current.ps1 line 2 malformed regex/unterminated
quote and full duplicated body. Observed Windows PowerShell ParserError.
Fix branch: pr9/patch6-fix-native-agent-installer-parser.
Status: FIX IMPLEMENTED; pending exact-head Windows PowerShell
5.1 / 7 parser CI and real Windows native agent pairing.
Do NOT classify the whole PR9 as PASS yet.

## PR9 Patch7 — User-requested P/C/O (2026-11-17)
Implementation: native installer displays P/C/O, warns about
stopping another process, demands secondary OVERRIDE confirmation,
and verifies listener identities before Stop-Process -Force.
Testing: native PowerShell AST parser 5.1/7 and Node structural
regressions required; manual Windows ConPTY and actual port override
remain OPEN. Never mark the overall PR9 PASS only from CI.

## PR9 Patch8 — Native viewport + detached CMD (2026-11-17)
User screenshot: prompt under footer, escaped CRLF disconnection
message and inability to close setup CMD conveniently.
Branch: pr9/patch8-terminal-layout-detached-agent.
Source fix: xterm FitAddon+ResizeObserver+flex viewport, native socket
status; one-time random token and detached hidden Local Agent process;
node-pty import prerequisite. Code/tests added; real Windows closing
CMD, tabs, shell editing and session persistence remain OPEN until
physical acceptance. Do not claim global PR9 PASS on automated CI.

## PR9 Patch9 (2026-11-17): node-pty probe SyntaxError
Patch8 CMD reaches dependency stage but PowerShell's node -e
argument quoting strips JavaScript quotes. npm 12 also reports
blocked node-pty@1.1.0 native lifecycle. New Patch9 standalone
probe-native.mjs and narrowly approved npm allowScripts with
native rebuild, Windows Node26 CI. Status: FIX DEVELOPED;
real Windows installed agent/interactive shell still requires
user acceptance. Patch9 expected to merge only after CI PASS.
