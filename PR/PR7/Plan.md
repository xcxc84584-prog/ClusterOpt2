# PR7 Plan — Patch(+1)
Status: PARTIAL / NOT PASS.
Baseline: PR6 Patch(+8) commit 755addd4.
Use original ClusterOpt Explorer UI, not a redesign.
Features in Patch1: scrollable File menu at browser zoom;
context-menu open/close root; atomic close of descendant tabs.
Security: identify descendants using FileSystemDirectoryHandle.resolve,
not just filename; never delete actual disk files. Cancel preserves state.
Performance: O(open document count) root-close identity checks.
Pending: durable ordering, type blocklist and additional context actions.

## Patch(+2): safe integration
Rebased onto main PR6 Patch(+10) with its successful Chromium
reload regression. CI tracks pr7/** branch and gates new actions.

## Patch(+3): shared file-type filter
Original ClusterOpt File Tool dialog and default extension set.
FileTypeManager publishes global BlockedFileTypes via HubUnit;
Explorer filters only its view, no data removal. O(N*B) for N
visible file entries, B up to 100. localStorage persists settings.

## Patch(+4) durable drag order
ExplorerOrderPolicy performs sibling-only in-memory moves, preserves
order during refresh, and records ordering in the existing IndexedDB
root session snapshot. Standalone tabs delegate to Workspace.reorder.
O(N) sibling reorder; O(N log N) visible tree ordering on reload.
Cross-root moves are rejected rather than changing disk file paths.
