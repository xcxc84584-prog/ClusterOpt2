# PR8 concurrent audit during PR9 Patch1
Baseline: main ee1c9d8e58da832d2ba930987a68654054b2ed19, version 0.0.8-pr8.patch25.fix2.
This is a source/issue inspection, not a full browser acceptance pass.

| ID | Finding | Status | Next acceptance |
| --- | --- | --- | --- |
| 22.2 | FileDocument still owns full-buffer small document editing | OPEN | uniform slicing and writeback |
| 23.4 | Worker CPU parallel processing still pending | OPEN | rapid scroll/wheel benchmark |
| 24.2 | Windows file permission/revocation and locks | OPEN | manual browser+filesystem test |
| 24.3 | 1/5GiB tests currently synthetic metadata, not disk crash benchmark | OPEN | physical stress tests |
| 25.3 | Explorer explicitly returns 501 for folder rename and paste | OPEN | legacy parity + filesystem test |
| 25.4 | Duplicate identities use isSameEntry but need browser alternate-handle test | OPEN | real browser test |
| 25.13 | Reauthorization depends on user gesture | OPEN | revoked/re-granted tests |
| 25.14 | Pages cache and runtime published version | OPEN | deployed page SHA |
| PR9 overlap | Workspace virtual page restore is async; scroll restoration may occur before content paint | Code mitigation on PR9 branch | Playwright reload/zoom validation |

PR8 should not be marked PASS. PR9 branch does not silently merge fixes into main.
