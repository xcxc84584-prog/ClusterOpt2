# PR8 Patch(+18) — Large-file admission and Piece Tree/B+ page bridge

## Baseline and rollback
- Base `main`: `a2c2cd0cdff682f60c9267de1cbb009d3d5d4cd6`
- Branch: `pr8/large-file-tree-bridge-patch18`
- Scope: incremental, safe large-file read-only page access within
  existing ClusterOpt UI. No user-facing developer messages.
- Do not label full editable virtual editor PASS until Patch19+.

## Implemented
- Added `Implementation/property/VirtualDocumentPolicy.js`:
  central threshold over existing 64 MiB full-buffer ceiling.
- Added `Implementation/object/VirtualFileDocument.js`:
  subtype of FileDocument with independent OCDA Request/Response,
  UserAPI, EHU and shared Property contracts.
- FileWorkspace.open uses file size metadata and instantiates
  VirtualFileDocument for large files. Legacy small docs retain
  original FileDocument editing, undo, recovery, UI and save.
- A virtual page loads via existing UTF8SlicePolicy bounded byte
  range (64 KiB plus UTF-8 alignment), constructs immutable
  PieceTreePolicy root and lazy-read BPlusSliceIndex.
- The existing textarea, tabs and Explorer remain in place;
  read-only virtual pages use scroll boundary wheel or
  Alt+PageUp/Alt+PageDown. Page number is shared Language Property.
- Never use whole-buffer Save or Edit for a partial virtual page.
  Legacy FileDocument.save also checks the on-disk source size to
  prevent a bad recovery snapshot from truncating a large file.
- SessionRecovery saves only virtual metadata/handle/page index,
  not the partial page as full text. Reopen through Hub on reload;
  without a valid handle, skip unsafe virtual restoration.
- Loading progress is per current page request, not file resident %.
- Tests added: synthetic 65-MiB file (bounded slice calls),
  Tree/B+ indices, page change, rejection and rollback on
  invalid index, 409 save guard, metadata-only recovery, and
  real Chromium OPFS 65-MiB UI open/page navigation.
- Version via LinkCore: `0.0.8-pr8.patch18`.

## EventChain / Relation / EHU
- UI.open -> Hub -> FileWorkspace.open -> size admission ->
  URU VirtualFileDocument register -> Hub -> load ->
  UTF8SlicePolicy -> PieceTreePolicy/BPlusSliceIndex -> OMU 200.
- UI page scroll -> Hub -> workspace.page -> Hub ->
  VirtualFileDocument.page -> atomic bounded page swap -> OMU 200.
- Invalid page 400; partial edit/save 409; stale file 409;
  unavailable handle 503; invalid UTF-8 422.
- Inspect VTE request/response directed Relation 10/01.
- Per-document page requests serialized; multiple independent docs
  can open concurrently through existing Workspace Promise.all.

## Security / performance limitations
- This is a read-only large-file page bridge, not the finished
  editable virtual text editor.
- Source file is never read wholly: only a bounded byte page and
  a few UTF-8 boundary bytes. The textarea contains just one page.
- Page-local line numbers are not global file line addresses.
  Patch19 must join VirtualLineIndex to viewport rendering,
  Piece Tree edits, MVCC and safe writeback.
- Real 1/5 GiB and external selected-file permission/latency
  tests remain pending. The 65-MiB smoke test is not proof of
  large-scale performance.
- Rollback previous main before any BC merge; keep current
  working editor and all prior recovery intact.

## References
- microsoft/vscode-textbuffer — Piece Tree based text buffer.
- MDN Blob.slice and FileSystemFileHandle.getFile documentation.
