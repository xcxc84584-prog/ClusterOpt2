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
