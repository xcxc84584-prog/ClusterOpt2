# PR8 PRD — Slice-Based Editor and Plugin Entry
Status: Pending. Must not be silently implemented inside PR6 or PR7.

## UI compatibility
Keep original ClusterOpt UI except explicit user changes:
File > Tool > Plugin (replaces the legacy highlighter entry).
Under Plugin:
- Performance > Maximum Text Loaded: numeric byte allowance or Off.
- Text Highlighter > default ClusterOpt rules or user-authored CSS rules.
- Highlighter plugin interface: input text slice -> CSS highlighting.

## Slice lifecycle
Virtual Address -> Slice Loader/Registry (P-tree + B+ index)
-> Processor Plugins -> Viewport Editor -> Submit Plugins
-> Commit/Writeback -> Unregister/Demote to Virtual.
Viewport load and adjacent preload, with zoom-adjusted windows.
Preloaded slices do not execute editor processor/submit plugins.
Progress bars reflect the current operation, not full-file residency.

## Security
Sandbox custom CSS rules and forbid network resources/remote imports.
Do not evaluate arbitrary JavaScript as a highlighter.
Preserve dirty MVCC changes during eviction and reload.
No unbounded cache when a configured byte budget is active.

## Latest UI acceptance (Patch10)
- File > Tool > Plugin opens a fixed, non-document workbench tool window,
  **not a modal dialog**.
- Tool window participates in the editor TAB strip: open once, select,
  reorder, close, and restore the tab state after reload.
- Category buttons (Performance, Highlighter, Slice Processor,
  Edit Committer) appear at the **top-right INSIDE the tool window**,
  never in the application-wide upper-right toolbar.
- UI is a fixed read-only layout; the explicitly supported settings
  controls are editable. Do not allow arbitrary text editing here.
- Preserve file content/scroll/selection when switching tool/document.
- All new request/response life cycles must have VTE relation and EHU
  tests, followed by green CI before any merge.

## Plugin availability target (not yet implemented)
- Developers may import custom versioned processor/committer/highlighter
  implementations with explicit permissions, time and memory budgets.
- Default processor modules: text highlighter, Chinese encoding aid,
  line-number helper; users may disable each independently.
- Default submit modules: MVCC maintenance and editor shortcuts;
  users may disable plugin behavior but must not bypass core file
  integrity guarantees or silently lose unsaved changes.
- Downloadable versioned API standards exist; they are not an
  executable plugin runtime.

## Patch(+11) category menu requirement
- Plugin Manager keeps one TAB-based read-only workbench window.
- Top-right within that window contains ONE File-style button whose
  category list is hidden by default and expands on demand.
- Drop-down supports keyboard navigation, Escape, outside click and
  auto-collapse on selection/tab switch. Never reserve permanent
  horizontal space for all four category buttons.

## Patch(+12): exact location acceptance and incremental indexing
- A Go-to-Line request must map to an exact file byte range, not
  proportional scroll ratio. Byte offsets are half-open.
- Virtual line indexing must not decode or hold the complete Blob.
- Maintain sparse checkpoints and bounded buffered scanning.
- Multi-byte UTF-8/Chinese/emoji and CRLF must round-trip line
  start addresses correctly; strict range and EOF validation.
- Actual editor viewport and PieceTree/B+ integration still pending.

## Patch(+17): verified slice-level writeback acceptance
- The trusted commit path must read a SHA-256 verified checkpoint,
  never arbitrary text supplied directly to the low-level writer.
- Validate expected disk file revision, byte range and source-region
  checksum before an explicit authorized file write.
- Stream unaffected prefix/suffix with bounded buffers; allow
  size-changing UTF-8 replacement and verify saved bytes.
- Handle writes must not evict or clear the dirty revision until
  readback succeeds and checkpoint retirement is CAS-safe.
- Failure statuses must preserve journal recovery (400/403/409/
  413/422/503 as appropriate), with OMU EHU and directed relations.
- Browser-file OS atomicity is not universal; recovery must handle
  the case where file close succeeds but verification does not.
- Validate in real Chromium OPFS and simulated file failure tests.
- No production FileDocument replacement or user-facing UI in this
  patch; integrate only after real selected-file permissions,
  full Recovery and UTF-16/UTF-8 mapping pass acceptance.

## Patch(+18): first large-file read-only editor admission
- Files exceeding the 64 MiB legacy whole-buffer threshold open
  in the original UI as a bounded, read-only virtual page.
- Do not duplicate all file bytes or silently switch partial page
  content into whole-file save/recovery.
- Page text must pass UTF8SlicePolicy, PieceTreePolicy and
  BPlusSliceIndex, with exact page byte addresses preserved.
- Existing FileWorkspace tab lifecycle and Language/UI_COLOR
  Properties remain authoritative. No additional standalone UI.
- Page navigation via original editor, following its scroll/wheel
  and keyboard conventions. Blue status tracks current load.
- Preserve the existing small-file workflow completely.
- Editable large-file viewport, global line positions and
  durable MVCC writeback are acceptance items for Patch19+.

## Patch(+19): editable pages and global line-number acceptance
- VirtualFileDocument page is editable through existing ClusterOpt
  textarea; a minimal UTF-16 splice updates Piece Tree only after
  a successful durable SliceEditTransaction MVCC checkpoint.
- No dirty-page eviction, navigation, or tab close until verified
  writeback; file Save streams original untouched bytes and validates
  replacement+source fingerprints, then retires exact checkpoint.
- Gutter and editor current position must show global LF line
  numbers across physical byte-slice boundaries (CRLF is one line
  break); page-local line numbering from 1 is forbidden.
- The UI must preserve original palette/language/Explorer/tabs and
  show operation completion in the existing status/progress controls.
- Recovery snapshot stores only bounded metadata (edit ID/revision,
  original disk fingerprint, SHA-256 source bytes, page address),
  never full-file text;
  reapply a checkpoint only after source identity verification.
- Real large 65 MiB browser edit and separate verified OPFS save
  test, plus O(page) UTF-16/UTF-8 and EventChain failures required.
- Explicitly defer continuous multi-GiB scroll, cross-page
  transaction and 1/5-GiB save performance to Patch20+.

## PR8 Patch(+19-Fix1) acceptance amendment
- Backward page must land on prior page's final line and bottom,
  while forward page must land on next page's first line and top.
- Preserve original textarea, tabs and global gutter; no new UI.
- Dirty large-file Close requires confirmation to save first;
  declined confirmation keeps edit and journal; accepted
  confirmation must finish verified writeback before tab removal.
- Existing clean-file Close must preserve synchronous API behavior.
- 65 MiB browser selected/OPFS regression must wait for a complete
  loaded page, then assert no unintended truncation on equal-length
  edit and Save; only validated success may mark status green.

## Patch(+19-Fix2) correction to acceptance
- Large-file Save/Close must work both through tab Close and through
  File/CloseAll and Explorer-close-group pathways.
- Uncommitted page must NEVER be discarded on failed save, cancelled
  confirmation, denied readwrite permission or a journal failure.
- Local file access must request permission in a live user gesture
  when supported, without altering original file picker behavior.
- All group tabs are retained if group save fails; no premature
  unregister, while completed verified saves may be clean.
- Regression must cover 65 MiB OPFS, existing PR1 synchronous Close,
  status EHU and final source byte-size.

## PR8 Patch(+19-Fix3) — progress and edit-interrupt
- Large file storage must not block tab switching or other UI.
- The original progress bar must track the current save operation's
  actual completed bytes, including copy and verification stages.
- Progress belongs to each document. Returning to a background
  saving document must show its true current percentage.
- User editing a saving document interrupts the uncommitted write,
  retains MVCC journal and then records the new edit.
- After the disk commit point, complete verification before
  processing the next edit: prevent false cancellation claims.
- No developer messages visible; preserve existing ClusterOpt UI.
- End-to-end slow I/O and cancellation tests are mandatory.
