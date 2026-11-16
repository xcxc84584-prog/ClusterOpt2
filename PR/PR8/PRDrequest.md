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
