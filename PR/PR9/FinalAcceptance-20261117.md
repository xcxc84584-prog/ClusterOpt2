# PR9 — Final Acceptance Audit (2026-11-17)

Baseline: main b8bface2f50e053e716ac14ce328ae09f821baed,
with PR9 Patch4 source changes on
pr9/patch4-final-audit-ps-version-installer.

| Requirement | Finding | Decision |
| --- | --- | --- |
| Ctrl+G and Go to Line | Existing GoToLinePolicy and browser tests | Page-local only |
| Go to Line avoids editor footer | Patch2 top-positioned dialog | Automated UI evidence |
| Global cross-page line seek | Policy rejects unloaded page with 416 | FAIL / OPEN |
| Scroll coordinate reload | One-shot pendingViewportRestore implemented | Large file manual QA OPEN |
| Explorer original file/dir features | Folder rename/paste 501 in Explorer | FAIL / OPEN |
| PSM button adjacent to Explorer | Legacy header control restored | CI browser evidence |
| Legacy setup/toolbar/multi-tab/native xterm | Original code/style vendored | Automated UI evidence |
| Current UI version label | Patch4 reads LinkCore.SystemVersion | New regression tests |
| CMD filename / installer target | Patch4 generated from current version and ClusterOpt2 source | New regression tests |
| Native agent version handshake | Mismatch rejected; agent reports version | New unit/loopback tests |
| Real Windows ConPTY / Node portable install | No Windows runner/physical acceptance | NOT TESTED |
| Old vs new UI screenshot pixel comparison | Not yet performed | NOT TESTED |

Decision: PR9 NOT PASS as a whole. Patch4 fixes a confirmed release
consistency error; user must verify actual CMD execution, native
ConPTY sessions, multiple tab close/reopen and file permissions.
No secrets or user-specific machine paths in source.
