# PR8 Patch(+16) — Durable Slice Checkpoint / MVCC Recovery Foundation

## Source / rollback
- Base main: `55bd7d0492df2cd00e80d1711a22f8647675424c`
  (PR8 Patch15 merged, CI verified on prior PR branches).
- Branch: `pr8/durable-slice-journal-patch16`
- Recovery baseline: checkout the immutable base main commit before
  merging this patch. Do not alter production main without CI and backup.

## Implemented
- SliceRecoveryJournal OCDA Object (persist/restore/discard).
- IndexedDBSliceJournalStore standalone adapter. Separate same-origin
  database clusteropt2-slice-journal; single entries object store.
- SliceJournalPolicy shared global Property:
  bounded checkpoint schema, SHA-256 content checksum and verification.
- SliceEditTransaction new actions:
  transactDurable (journal first, publish only after ack),
  restoreDurable (reload verified revision/text into Piece Tree).
- Existing volatile editing / disk FileDocument remains unchanged.
- Live main registers sandbox Objects for HubUnit + VTE only.
- Test suite: recovery after recreated core runtime, storage failure
  rollback, corruption rejection, stale revision, unauthorized API,
  OMU EventChain and directed 10/01 relation assertions.
- Browser E2E: real IndexedDB reload with Chinese text, and same-origin
  two-tab revision CAS conflict. Pending CI on latest head.
- LinkCore published version `0.0.8-pr8.patch16`.
- Plan, ArcD and global property registry updated.

## EventChains / EHU
- UI/VTE -> Hub -> SliceEditTransaction.transactDurable -> PieceTree
  candidate -> Hub -> SliceRecoveryJournal.persist -> IndexedDB commit
  -> immutable root publish -> OMU Log/Dependency, status 200.
- UI/VTE -> Hub -> SliceEditTransaction.restoreDurable -> Hub ->
  SliceRecoveryJournal.restore -> verify SHA-256 -> reconstruct root
  and preserve revision/dirty, status 200.
- Failure statuses 400 invalid, 403 unauthorized journal mutation,
  404 missing, 409 stale/dirty, 422 bad integrity, 503 storage error.

## Failure containment and known gaps
- A failed storage write does not replace the in-memory root.
- A crashed runtime may restore the most recent committed checkpoint.
- Full slice snapshot uses bounded memory but is not write-ahead
  operation-delta journaling. This is a foundation, NOT a completed
  full-document persistent recovery or atomic file writeback.
- Cross-tab revision comparison and storage use
  IndexedDBSliceJournalStore.putIfNewer with a single readwrite
  transaction. Multi-tab browser E2E remains to be verified.
- Corrupt persisted checkpoint returns EHU 422, never silent fallback.
- No untrusted plugins or credentials introduced.
- Real browser IndexedDB fault-injection tests remain outstanding.
- No direct file writeback nor viewport/cursor state restoration.

## Verification
```sh
npm run check
node --test Implementation/tests/pr8-patch16-journal.test.js
npm run test:e2e
```
All live EventChains require VTE EHU, Log, Dependency and relation
verification before merging. Preserve recovery baseline.
