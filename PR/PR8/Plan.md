# PR8 Plan (initial draft)
- Requirements: virtual-first slices; P-tree primary plus B+ tree auxiliary.
- Algorithms: logarithmic piece insert, chunk-index seek, bounded LRU.
- Performance: no full-buffer read on large files; tune viewport and preload.
- Security: CSS-only plugin validation and sandboxing, IndexedDB quota
  handling, atomic writeback and MVCC snapshots.
- Data: max fully-loaded plus preloaded bytes settable, or Off.
- Load colors: blue per-operation percentage, not global document share.
- Tests: rapid scroll, goto-line, zoom, cross-file switch, dirty eviction,
  reload recovery, progressive memory pressure and malicious CSS rejection.
