# PR8 Patch(+17) — Streaming Slice Writeback Foundation

## Baseline / rollback
- Pre-patch main: `4f2732f8efd15c6eedd4995a16d539900bd2b224`
- Branch: `pr8/streamed-writeback-patch17`
- Do not merge until CI/VTE/browser verification and pre-merge backup.
- PR8 continues NOT PASS; FileDocument remains unchanged.

## Changes
- Added `Implementation/property/SliceFileWritePolicy.js`
  with validation, SHA-256 source-region conflict checking, bounded
  64-KiB Blob streaming prefix/suffix, exclusive writer and readback.
- Added `Implementation/object/SliceWritebackUnit.js` OCDA blackbox:
  only Hub-mediated internal Request commit, UserAPI=[].
- Added `SliceEditTransaction.commitWriteback`: only the current
  dirty and durable revision can be saved; clean status follows
  verified file readback and exact checkpoint retirement.
- Added `SliceRecoveryJournal.retire` and atomic
  `IndexedDBSliceJournalStore.deleteIfMatch`, requiring both
  expected revision and checkpoint checksum.
- Registered `SliceFileWritePolicy` once in LinkCore EDPMU,
  set SystemVersion 0.0.8-pr8.patch17.
- Main registers the new Object for sandbox/VTE only.
- Added Node tests for successful size-changing writeback,
  stale external file, aborted write, corrupt readback,
  non-durable/stale revision and Hub relation 10/01.
- Plan.md, ArcD.md, global property inventory and pending tests updated.

## Event Chain and failure matrix
UI/VTE -> Hub -> SliceEditTransaction.commitWriteback
  -> Hub -> SliceWritebackUnit.commit
  -> Hub -> SliceRecoveryJournal.restore
  -> SliceFileWritePolicy.fileConflictCheck
  -> authorized FileSystemFileHandle.createWritable(exclusive)
  -> bounded chunk copy + replacement -> writer.close
  -> readback byte verification
  -> Hub -> SliceRecoveryJournal.retire
  -> IndexedDB deleteIfMatch -> clean state.
- 400: invalid range/handle.
- 403: direct user access to low-level writeback.
- 404: missing journal checkpoint.
- 409: stale revision, external change, dirty guard.
- 413: too-large slice.
- 422: corrupt source/readback.
- 503: write permission, storage or platform errors.

## Important safety limits
- This does NOT claim OS-level atomic replacement. MDN notes
  createWritable typically stages a temporary file and swaps it on
  close; the exact guarantees depend on browser/filesystem.
- File writeback can be ambiguous when the close succeeded but
  readback or journal retirement subsequently fails. Preserve the
  checkpoint and dirty state; a future recovery action must reconcile.
- Source-file external modification during the write cannot be fully
  excluded by browser API, despite exclusive stream and fingerprint.
- The algorithm rewrites and verifies the entire source in bounded
  chunks: transient memory bounded, I/O proportional to file size.
- Only file byte ranges are replaced. Unicode UTF-16 offsets from
  Piece Tree must be mapped to byte offsets at the call site.
- No production FileDocument/Explorer integration yet.
- No untrusted plugins; no secrets, machine paths, or UI diagnostics.

## Verification
```shell
npm run check
node --test Implementation/tests/pr8-patch17-writeback.test.js
npm run test:e2e
```
- VTE: Request/Response, EHU/Log, 10/01 dependency, failure 403/409.
- Browser: smoke existing editor, inspect source file preservation,
  permission errors and large file performance before production use.
- Backup main and verify commit checksum before merging.
