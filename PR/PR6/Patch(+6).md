# PR6 Patch(+6) — Reload protection
- Added SessionRecovery Object with IndexedDB transaction storage.
- Added single shared RecoveryPolicy for schema validation and limits.
- Added workspace snapshot/restore with scrollTop and uncommitted text.
- Added Explorer root handle snapshot and non-destructive restore.
- Added debounced sequential writes and startup restore.
- Updated Plan/ArcD/global registry/tests/handoff.
- Remaining: full browser recovery and permission regression, PR7.
Status: PARTIAL, test before merge.
