# PR8 Patch(+19-Fix3): responsive background save

## Baseline and objectives
- Base main: 36fcb332c7fb2562b6162926da2e714d6ab5e398.
- PR8 incomplete; implement Save progress and non-blocking
  operation while keeping original ClusterOpt UI.
- Read latest Patch19-Fix2 handoff, property inventory,
  Plan/ArcD and existing Writeback/Workspace dependencies first.

## Implementation
1. New independently routed SliceSaveTask Object provides
   begin/progress/cancel/finish/state and a per-document
   AbortController; cancellation can run while the document Hub
   queue is occupied by Save.
2. FileWorkspace.save returns immediately for virtual documents;
   async writeVirtualDocument performs real Hub save and retains
   per-document saveActive/saveProgress/saveError. Normal small file
   synchronous interfaces remain unchanged.
3. Actual byte-stream Writeback progress from bounded 64KiB writes,
   source copy, readback and hash verification. Yield to browser
   event loop every eight chunks; progress capped at 99 until verified.
4. UI active document status is blue and reports the Save operation
   percent. Switching tabs does not stop the task; switching back
   reads the document-local current percentage.
5. New user edit invokes SliceSaveTask.cancel through HubUnit before
   submitting PieceTree edit. The stream aborts before close; journal
   remains durable. Post-close requests finish verification before
   new edits, avoiding false rollback of committed bytes.
6. Progress updates repaint status only, without re-rendering the
   entire editor, Explorer or tab list.
7. Bilingual status text goes through shared Language Property.

## Event Chain, relation and errors
UI Save -> Hub workspace.save -> task.begin -> Hub doc.save ->
  SliceEditTransaction.commitWriteback -> SliceWritebackUnit.commit
  -> bounded stream copy, digest, readback -> journal retire
  -> Hub task.finish -> status green.
UI Edit -> Hub task.cancel (separate scheduler key) ->
  AbortSignal -> writer.abort / EHU499 -> Hub doc.edit ->
  journal persist new revision. UI switch -> Hub workspace.activate.
Hub/OMU records directed Request=10 and Response=01.
Errors: 403 permissions, 409 revision conflict, 422 hash mismatch,
499 cancelled before commit, 503 file/stream/quota faults.

## Risk
- Browser FileSystemWritableFileStream commit point is writer.close.
  Cannot promise cancellation after close.
- A verification failure after successful file close can leave an
  ambiguous on-disk state; preserve checkpoint and do not mark clean.
- Current Writeback still copies and verifies entire file in
  bounded chunks. 1/5 GiB and power-failure acceptance pending.
- Explicit close waits on verified Save and may hold workspace
  queue; background Save button does not hold it.
- Never remove the tab merely because a cancellation was requested.
- Browser slow disk tests needed before main merge.

## Tests
- Node: task state, monotonically increasing percentage, cancel,
  independent docs, conflicting begin EHU409.
- Chromium: 65MiB slowed writeback, switch tabs mid-Save and
  restore correct percentage; start edit to abort incomplete
  writeback, preserve disk and journal.
- Full PR1–PR7 regression and CI mandatory; verified backup first.

## Verified merge and rollback — 2026-11-17
- PR #24 final HEAD `21d0338be48896b921e05d72edbcc85f0fe71407`
  passed OCDA CI and PR1 OCDA Verification, including both
  Chromium browser jobs, unit and verify jobs.
- Merge SHA: `255f8c954624f46160d735dec25efc059220aa62`.
- Verified rollback branch
  `backup/pre-pr8-patch19-fix3-main-20261117`
  identical to old main
  `36fcb332c7fb2562b6162926da2e714d6ab5e398`.
- Background Save reuses an active per-document savePromise when
  a user closes that file, preventing concurrent duplicate writes.
- PR8 remains NOT PASS; 1/5 GiB and selected Windows disk
  permissions/crash tests are not covered by OPFS automation.
