# PR4 Patch(+3): Shared StoragePriority and external synchronization

Date: 2026-11-16
Status: FUNCTIONAL IMPLEMENTATION ON PR #5; TESTS WRITTEN, NOT YET VERIFIED.

## Source
- Implementation/property/StoragePriority.js: one shared priority definition.
- Implementation/LinkCore/LinkCore.js: centralized property and version 0.0.4-pr4.patch3.
- Implementation/object/FileDocument.js: disk fingerprint and reconcile operation.
- Implementation/object/FileWorkspace.js: policy setter, persistence,
  parallel document checks, pre-save conflict reconciliation.
- Implementation/main/main.js: bounded 3s background check during visible page,
  focus/visibility triggers, priority buttons, external-reload repaint.
- index.html and Language adapters: reuse legacy Tool menu and bilingual UI.

## Modes
ExternalFirst: when disk metadata revision changes, replace editor buffer
with current external file contents; on pre-save conflict, skip disk overwrite.
InternalFirst: preserve editor text on external overwrite, show DIRTY;
subsequent save may intentionally overwrite disk.
Default InternalFirst; UI selection stored locally where browser permits.

## Tests written
Implementation/tests/pr4-storage-priority.test.js covers both modes,
pre-save conflict and invalid preference (400).
Previous Patch(+2) unit/browser tests remain part of verification gate.
No completed CI, browser or File System Access device tests claimed.

## Known risks
File change fingerprint uses lastModified + size, not cryptographic hash;
same-size, same-timestamp mutation is undetectable. Browser API permissions,
poll races, independent tabs and external saves require real browser testing.
Version label is centralized in LinkCore but deploy cache needs cross-browser check.

## Recovery and release
Backup `backup/pre-pr4-20261116` was created from main before edits.
Only merge PR #5 into main after test evidence and data-integrity review.
No force-push or destructive rollback operation should occur.

## Verification infrastructure amendment
Created `.github/workflows/ocda-ci.yml` with Node 20 unit/lint gate
and Chromium Playwright gate on main/PR4 branch updates.
Revised browser File mock to keep stable lastModified until actual write;
fixed URU object-list test to assert returned string IDs.
Static JS syntax checks for ten affected source/test modules PASS;
all inspected source lines fit the 120-column convention.
A mocked FileWorkspace smoke check PASS for reorder, cancelled Close All,
accepted Close All and valid setPriority; this does NOT replace CI.
Current GitHub connector reports no finished workflow runs or statuses.
