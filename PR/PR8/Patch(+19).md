# PR8 Patch(+19) — Editable virtual pages and continuous line numbers

## Baseline and rollback
- Base main: `99387f8da7f40b8f38d05a0a9b5442a7e1e0fa87`
  (Patch18 merged; latest handoff read before this patch).
- Development: `pr8/editable-virtual-pages-patch19`.
- Never merge before full CI, VTE and verified previous-main backup.
- PR8 remains incomplete. Patch20 must address fast scroll/performance.

## Implementation scope
- New shared `VirtualPageLinePolicy` (one EDPMU registration):
  bounded 64-KiB LF-prefix counting from nearest byte checkpoint,
  lineNumber calculation and minimal UTF-16 edit diff.
- `VirtualFileDocument` now supports one editable bounded page:
  PieceTreePolicy candidate, lazy BPlusSliceIndex rebuild, journaled
  `transactDurable` before publishing new text and status yellow.
- Global gutter line numbers use document.pageFirstLine, not 1
  on every page; editor position uses same global line numbering.
- The original ClusterOpt textarea, Explorer, tabs, color palette
  and language layout are reused; no new UI shell.
- Edited pages cannot be unloaded/navigated/closed until saved.
  Workspace.close/closeMany/closeAll guard dirty virtual documents.
- Save routes FileWorkspace -> VirtualFileDocument -> HubUnit ->
  SliceEditTransaction.commitWriteback -> SliceWritebackUnit;
  validates source file size/mtime and original slice hash,
  streams file bytes, verifies final content, retires exact journal
  checkpoint, marks page green and reloads its aligned byte window.
- `Save As` for virtual page is intentionally unsupported until
  full-file cloning is safe; a partial page cannot overwrite file.
- Recovery snapshots include virtual source fingerprint, page index,
  byte range, journal ID and revision, NOT page text; restoring only
  proceeds if the same authorized file fingerprint matches.
  Failed restoration retains the checkpoint and sets an error.
- Progress is based on current page operation; no full-file loaded%
  deception. Per-page text bounded by SliceTransactionPolicy 1 Mi
  UTF-16 and ~64 KiB source byte address window.
- Case handling: UTF-8 / LF / CRLF global positions,
  Unicode astral code points in UTF-16 PieceTree updates,
  stale file or revision conflict, storage failure.

## Failure policy / EHU
- 200: page edit, save and navigation; 400: invalid page/range;
  409: dirty navigation/close, stale source or revision;
  413: oversized edit; 422: invalid UTF-8/readback;
  503: IndexedDB/quota/cryptography or file write failure.
- No cross-object direct calls; route all actions through HubUnit
  and inspect OMU 10 Request/01 Response + failure EHU.

## Known limitations
- This is editable page-window rendering, not the final smooth
  viewport that maps one scroll bar over a multi-GiB document.
  Navigation is page-by-page; cold distant line scan can be slow.
- True multi-page contiguous selection, cross-page edit transactions
  and global line jump remain pending.
- Patch17 Save streams/copies/validates the entire file, O(file
  bytes) I/O; 1GiB/5GiB save latency is NOT yet acceptable.
- Crash recovery depends on a valid browser File Handle, recovery
  snapshot and IndexedDB checkpoint; multi-tab same-file binding,
  power-loss recovery, quota and browser permission failure remain
  for Patch23.
- No automatic user plugin execution. No absolute file paths or keys.

## Test plan
```sh
npm run check
node --test Implementation/tests/pr8-patch19-virtual-edit.test.js
npm run test:e2e
```
- Unit/VTE: continuous lines across 64KiB, durably edited page,
  save success, blocked navigation, stale source conflict, EHU503,
  Unicode, recovery/reload.
- Browser: 65MiB OPFS window stays editable; first line of
  next page reflects LF count; dirty page cannot navigate; small
  OPFS virtual document actually commits and retires checkpoint.
- Full 1GiB/5GiB and real selected-file permission tests pending.
