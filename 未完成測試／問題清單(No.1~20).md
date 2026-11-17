# PR1 Outstanding Checks — Patch(+2)

Status: unverified unless explicitly marked. Submission is not proof of PASS.

| No. | Requirement | State |
| --- | --- | --- |
| 1 | Open file | Browser test pending |
| 2 | Create file | Browser test pending |
| 3 | Edit and save | Browser test pending |
| 4 | Save As | Browser test pending |
| 5 | Multiple tabs | Browser test pending |
| 6 | Dirty close confirmation | Browser test pending |
| 7 | Four-color status | Browser test pending |
| 8 | Loading operation percent | Browser test pending |
| 9 | Line number scrolling | Browser test pending |
| 10 | Permission errors | Browser test pending |
| 11 | No duplicate tabs | Browser test pending |
| 12 | Non-UTF8 | Unsupported |
| 13 | Large-file performance | Deferred PR7 |
| 14 | External changes | Deferred PR4 |
| 15 | EHU/fail logging | Automated test submitted |
| 16 | Runtime registry reset | Automated test submitted |
| 17 | Relation Code | Automated test submitted, probes pending |
| 18 | VTE sandbox | Not implemented |
| 19 | UI accessibility | Browser test pending |
| 20 | Secure-context file API | Browser test pending |
| 21 | Authorization Public/Protected/Private | Not implemented |
| 22 | Per-object User/Agent API contract | Not implemented |
| 23 | Property updates routed exclusively through Hub | Partial |
| 24 | CI status | Not yet verified |
| 25 | Full OCDA relation test | Not implemented |

## Patch(+4) status additions
- 26: Legacy ClusterOpt stylesheet copied — visual browser review pending.
- 27: Browser user-gesture picker flow corrected — Chromium test pending.
- 28: Strict Object contract registration — automated test submitted.
- 29: Protected inherited Properties — automated test submitted.
- 30: VTE isolation — automated test submitted.
- 31: Independent file load overlap — code implemented, browser test pending.
- 32: UTF-8 BOM/CRLF preservation — automated test submitted.
- 33: Reject unsafe encoding — automated test submitted.
- 34: 64 MiB PR1 memory bound — code implemented, test pending.
- 35: Nested deadlock detection EHU 423 — automated test submitted.
- 36: Code-conventions lint — CI submitted.
- 37: Cross-tab locking — out of PR1 scope, must document.
- 38: Browser end-to-end interaction — still pending.
- 39: Runtime identity spoof prevention — future agent security boundary.
- 40: Latest CI status — must be read from GitHub before merging.

PR1 is not considered accepted based on source code alone.

## PR2 Pending Checks
- PR2-01: RGB picker updates global token — automated tests submitted.
- PR2-02: RGB numeric fields and endpoints — browser tests submitted.
- PR2-03: Saved preference reload — browser and Node tests submitted.
- PR2-04: Invalid RGB preserves last valid state and logs EHU — submitted.
- PR2-05: Permission checks for AgentAPI mutation — submitted.
- PR2-06: Original modal visual parity on desktop/mobile — pending manual review.
- PR2-07: Verify final PR2 commit both CI jobs PASS — pending.

## PR3 open verification list
- PR3-01: Chinese/English shared Language Property and UI menu: automated checks submitted.
- PR3-02: Editor, palette and file-close warnings all reflect locale: automated checks submitted.
- PR3-03: Persistence across refresh and invalid/unavailable storage: automated checks submitted.
- PR3-04: AgentAPI blocks mutation, invalid locale EHU: automated checks submitted.
- PR3-05: Windows Chrome manual UI/permissions and accessibility review pending.
- PR3-06: Latest head CI verify + Chromium browser jobs pending.

## PR3 automated results (Patch+2)
- Node relation/unit tests: 43/43 PASS, source commit c1e2a98b.
- Chromium UI integration: 9/9 PASS, source commit c1e2a98b.
- Code conventions: 30 source files PASS.
- Native Windows browser visual comparison and file permission dialogs:
  manual acceptance pending; does not negate automated pass.

## PLUGIN major PR03 gate — separate from original UI PR3
- PLUGIN PR03.01: PASS on exact-head f501dc6a; restore verified.
- PLUGIN PR03.02: PASS on exact-head c21032a; restore created.
- PLUGIN PR03.03–03.10: code and Relation Tests committed;
  exact-head Node/Chromium/PR02/OCDA/PR1/Windows gate pending.
- ReleaseVersion.js is canonical product version; npm CI checks
  package.json mirror. No product bump before guarded major release.
- Untrusted Worker sandbox, remote plugin factories, route unbinding,
  inflight draining and real File I/O are deferred to PR04–06.
- PR03 major merge forbidden until exact-head PASS and final
  rollback snapshot; original editor large-file manual tests remain open.

## PLUGIN PR04.01 outstanding acceptance
- PR04.01 Node, VTE and Chromium tests: PENDING latest-head CI.
- PR04.02–PR04.10 Route Table, ACL, and execution paths: TODO.
- Real browser File System Access/manual 5GiB edit: NOT validated.

## PLUGIN PR04.03 status
- Replace-route runtime/ACL/VTE code and regression tests submitted.
- Exact-head CI and restore proof: pending; no PASS until confirmed.
- External route ACL (PR04.08), routeVersion/CAS (PR05) outstanding.
- Real 5GiB and browser file permission manual tests remain open.
