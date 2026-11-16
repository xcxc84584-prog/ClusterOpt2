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
