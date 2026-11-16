# PR8 Patch(+19-Fix4): multi-slice edits and optimized disk writeback

## Reference — old ClusterOpt
- Compared Program/src/fmc/virtual-file-session.js and
  Program/src/fmc/storage-progress-tracker.js from old repository.
- Old approach: dirty map of resident slices, keep unsaved pages
  across navigation, copy unchanged Blob.slice directly during Save,
  only update MVCC persisted markers after a completed stream.
- New integration retains LinkCore/HubUnit/OMU/EDPMU/URU,
  persistent SHA-256 journaling, per-page Piece Tree and B+ index,
  instead of copying the old standalone MVCC implementation.

## Baseline and changes
- Base main: 5f5dbfa55885dfc8280d5d1e90398df7835b22a9.
- Branch: pr8/patch19-multislice-nonblocking-fastwrite-fix4.
- New shared Property: SliceBatchWritePolicy.
- New Object: SliceBatchWritebackUnit with Hub-only commit API.
- VirtualFileDocument now retains multiple dirtyPages by byte
  range, journal identifier and immutable Piece Tree revision.
  Navigation retains dirty state; revisiting restores its content.
- Global LF line numbers include deltas from prior modified pages.
- Workspace recovery snapshot includes multiple metadata-only
  page references. Journal contents are verified upon lazy restore.
- SliceEditTransaction.finalizeBatch is guarded by MVCC revision
  after verified disk commit and journal retirement.
- Single Save composes every registered dirty page into one ordered
  and non-overlapping source-byte replacement sequence.
- Equal-length UTF-8 edits use browser keepExistingData + positioned
  writes; size-changing edits stream untouched Blob slices without
  JS decode or per-slice SHA, with cooperative event-loop yielding.
- Checks source size/mtime, dirty source region hashes and final
  changed region readback plus final file size.
- Continues prior Patch19-Fix3 background Save/progress/cancellation
  and original UI structure, preserving small-file workflows.

## Integrity boundaries
- OS/browser FileSystemWritableFileStream decides whether
  keepExistingData internally copies the entire source. Therefore
  application hash work is reduced, but disk operation O(changed)
  is NOT guaranteed.
- Unchanged spans are NOT completely SHA-256 verified after Save.
  They rely on the source File Blob snapshot, prewrite fingerprint
  and browser copy semantics, an explicit tradeoff against full
  SHA-256 verify of Patch17. Edited spans ARE hash-readback checked.
- A crash after close/before journal retirement may still require
  reconciliation. Original disk atomicity cannot be guaranteed.
- Dirty resident transactions have current 64-slice cap. Never
  evict an unsaved page to stay under resource budget; reject 413.
- Previously restored but unvisited dirty pages are hydrated during
  Save by SHA-256 and fingerprint validation; no hidden edit is omitted.
- 1 GiB/5 GiB latency, manual OS permission and crash tests OPEN.

## EventChains, relation and EHU
- UI.edit → HubUnit → VirtualFileDocument.editPage →
  SliceEditTransaction.transactDurable → SliceRecoveryJournal.persist
  → dirtyPages publish / OMU 200.
- UI.page → HubUnit → FileWorkspace.page → VirtualFileDocument.loadPage
  → retained dirty revision or UTF8SlicePolicy.read → current slice
  and LF adjusted line number / OMU 200.
- UI.save → FileWorkspace detached save task → VirtualFileDocument
  → SliceBatchWritebackUnit.commit → journal restores →
  SliceBatchWritePolicy.commit → readback → journal retires →
  SliceEditTransaction.finalizeBatch → reload / OMU 200.
- UI.edit while saving → SliceSaveTask.cancel → AbortSignal →
  writer.abort / EHU499 → queued durable new revision.
- Failures: 400 invalid overlapping source addresses; 409 stale
  MVCC or source; 413 memory quota; 422 changed byte mismatch;
  499 aborted stream; 503 unavailable storage.
- Hub Request=10, Response=01, fail EHU always recorded.
- PR8 overall NOT PASS until full acceptance.

## Verified CI, backup and merge (2026-11-17)
- PR #25 final branch SHA:
  `d2e3c8913193241f6bb56fd02ba6dfccbcc18ba5`.
- Both GitHub Actions workflows `OCDA CI` and
  `PR1 OCDA Verification` PASSED: unit, verify and both
  Chromium browser jobs.
- Merge SHA: `c6a693e21ea43b4d0fc99fcac4b281e913d87ba2`.
- Verified pre-merge rollback branch:
  `backup/pre-pr8-patch19-fix4-main-20261117`,
  identical to previous main
  `5f5dbfa55885dfc8280d5d1e90398df7835b22a9`.
- E2E included 65MiB background Save while showing Explorer context
  menu, opening a file, switching tabs and editing a different
  document, plus unsaved edits on two pages committed together.
- Hidden dirty recovery pages can be hydrated from SHA-256 verified
  Journal checkpoints during Save, so offscreen edits are not lost.
- Node exercised same-metadata modified-source rejection (EHU409),
  byte-neutral positioned writes, length-changing Blob fallback,
  global LF offsets and cancellation with journals retained.
- PR8 remains NOT PASS: multi-GiB latency, real Windows file
  permission/lock, cross-tab same-disk conflicts, whole-file
  post-save cryptographic hashing and power-loss recovery remain
  outside automated acceptance.
