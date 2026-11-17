# PR8 Patch(+26) — Unified source slice pipeline (draft)

## User request
Unify small and large file loading/edit/writeback through the same
bounded file slice mechanism, preserving original ClusterOpt's user UI.
Do not invent extra slice buttons or replace the old GoToLine toolbar.

## Architecture
Physical FileSystemHandle -> getFile() -> VirtualDocumentPolicy
isUniformSliceFile -> VirtualFileDocument for ALL real file sizes
 -> UTF8SlicePolicy bounded 64 KiB pages
 -> PieceTree/BPlusSliceIndex
 -> SliceEditTransaction durable MVCC -> SliceBatchWritebackUnit
 -> validated local file writeback + journal retirement.
FileDocument remains a compatible fallback ONLY for newly created
unsaved buffers and mock/non-Blob test handles where the transaction
registry is intentionally absent. Previously restored legacy unsaved
sessions also retain their original FileDocument identity.

## Behavior
- Source page text never requires loading the full file into memory.
- Original LF counting applies to every selected file, and all normal
  Ctrl+G global line navigation is backed by PR9 Patch5 locator.
- Existing browser/editor TAB, Explorer, language, palette and status
  UI are unchanged.
- CRLF textareas normalize line endings; VirtualPageLinePolicy
  sourceTextFromEditor converts only the minimal changed span back
  to raw source text, retaining all other mixed CRLF/LF source bytes.
  The actual durable MVCC revision stores source-correct text.
- Existing authorization, dirty journal and hash check remain
  enforced; no navigation bypass of dirty-page CAS.

## Regression
- Existing PR1–PR9 unit and Playwright suites, plus new small OPFS
  edit/save/readback, 64 KiB medium boundary and CRLF preservation
  regression tests.
- Existing legacy-only test updated to expect all selected sizes
  use virtual pages when the full slice engine is registered.

## Risks / pending gates
- Windows native file handles and blocked permissions still need
  physical acceptance; Docker/Linux Chromium alone is insufficient.
- 1/5 GiB real disk read, Save and crash recovery benchmarks missing.
- Legacy recovery migration, bare CR and non-UTF8 file handling
  require separate specific tests.
- Do not claim PR8 PASS before these gates are satisfied.
