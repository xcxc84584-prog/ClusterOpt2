# PR8 Patch(+19-Fix2) — Dirty large-file Save / Close unblock

## User reproduction
Console EHU: `workspace Response.close 409`, error
`Save virtual page before closing`. The exact string was an older
guard and is not emitted by the new single-tab Close handler in
Patch19-Fix1; a stale loaded module or another close path is possible.
No original file is discarded automatically.

## Scope
- Keep the original ClusterOpt UI, styles, tabs and editor.
- Repair FileWorkspace.closeMany / closeAll which still rejected
  virtual documents with dirty edits using unconditional EHU409.
- Add shared saveVirtualGroupBeforeClose with a single localized
  confirmation and Hub-mediated per-document writeback.
- Do not unregister ANY tabs until all involved virtual documents
  have completed verified writeback; on cancel/failure preserve tabs
  and any remaining dirty checkpoint. Previously committed documents
  may become clean, but no pending edit is discarded.
- Preserve synchronous return values on all normal close paths.
  The async helper is entered only for dirty virtual documents.
- For normal local FileSystemFileHandle, request readwrite
  permission during the original user click before asynchronous Hub
  dispatch. Distinguish permission refusal from storage failure.
- Do not introduce an await before existing user-gesture File Open
  or Save As pickers; OPFS handles without requestPermission continue.
- Language strings follow shared EDPMU Language property.
- Add Chromium OPFS regression for 65 MiB CloseAll full-byte save,
  cancel and denied permission; no new visible debug/test UI.
- Versioned handoff updated; test results not assumed until CI ends.

## Security and data integrity
- Browser File System Access API `requestPermission({mode:"readwrite"})`
  may require transient user activation. A denied grant must never
  run file commit or unregister a dirty page.
- CreateWritable exclusive stream still requires authorization and
  does not promise arbitrary OS-level atomicity.
- Entire-file writeback remains O(file length) I/O, with bounded
  memory. A 65 MiB test does not prove 1/5 GiB performance.
- A failed save leaves dirty status and checkpoint; EHU may indicate
  403/409/422/503. Never treat a guard 409 as a successful close.

## EventChain
User Save/Close/CloseAll -> UI user-activation permission gate
-> HubUnit -> FileWorkspace.close/closeMany/closeAll ->
Language Property confirm -> HubUnit -> VirtualFileDocument.save ->
SliceEditTransaction.commitWriteback ->
SliceWritebackUnit.commit -> SHA-256 checked bounded file stream ->
readback verification -> journal retire -> FileWorkspace.unregister.
Cancel/denied/error exits before unregister; OMU records EHU.

## Verification
- npm run check
- npm run test:e2e
- Node/VTE Request+Response/EHU and prior PR1 close regression
- Chromium E2E 65MiB save/CloseAll/permission denial/cancel.
- CI and premerge backup must pass before merge.
