# PR1 — Requirement Definition

## Target
A basic local-first text editor with a reusable OCDA development foundation.
Preserve the original ClusterOpt UI theme and layout rather than redesigning it.

## Acceptance criteria
- PR1-01: New/open/edit/save/Save As/close operations.
- PR1-02: Multiple document tabs and switch without losing unsaved text.
- PR1-03: Per-operation blue loading progress, green synced,
  yellow dirty, and red error state.
- PR1-04: Correct line numbers and editor scroll alignment.
- PR1-05: One source file per Object / shared Property; LinkCore four units.
- PR1-06: All inter-object Request/Response must traverse HubUnit.
- PR1-07: Dynamic registration, response/EHU logging, relation observation.
- PR1-08: Public/Protected/Private basic access enforcement and SubObject paths.
- PR1-09: Shared Property registry, central version publication.
- PR1-10: Independent objects can run asynchronous I/O concurrently,
  while same-object writes remain serialized FIFO.
- PR1-11: VTE isolated in-memory tests, with no production file mutation.
- PR1-12: No credentials, tokens, absolute paths, or unsafe implicit I/O.
- PR1-13: Code quality, automated relation/unit tests, browser smoke test.

## Explicit non-goals
- PR2 UI palette; PR3 multilingual UI; PR4 external overwrite priority.
- PR5/6 Explorer; PR7 P-tree, B+ tree and virtualized gigabyte files.
- PR8 GoToLine; PR9 PowerShell.
- Web Worker CPU parallelism is not part of basic PR1 asynchronous I/O.

## Release condition
Mark PR1 complete only after all PR1 criteria and CI/browser tests pass.
