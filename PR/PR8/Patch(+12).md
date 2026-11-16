# PR8 Patch(+12) — Sparse UTF-8 line-to-byte navigation

**State:** validation in progress; PR8 NOT PASS.

## Requirement and source research
- Continue the six-layer PR8 editor without replacing the existing
  working editor with an unsafe partial implementation.
- Accurate Go-to-Line requires real line-start byte offsets rather
  than guessing positions from file size or scrollbar percentage.
- Reference: microsoft/vscode-textbuffer and rebornix/PieceTree;
  VS Code stores text in a piece tree and supports line-oriented APIs.
- Reference: MDN Blob.slice for bounded binary access.

## Implementation
- New OCDA Object: VirtualLineIndex
  - open: register Blob by id, zero reads during open.
  - locate: exact 1-based line start byte offset, lazy scan.
  - range: exact half-open byte range for line span.
  - describe: safe index metadata only.
- New shared Property: LineAddressPolicy, registered by LinkCore.
  - Scan Blob in 64-KiB windows, yielding after eight windows.
  - Detect byte 0x0A (LF), so UTF-8 continuation bytes are safe.
  - Count CRLF as one break; CR-only files need future support.
  - Sparse checkpoint every 4096 line breaks. Binary-search those
    checkpoints and rescan bounded windows on backward seek.
  - No complete string decode or full-file allocation.
- ViewportSlicePolicy.bytePlan maps exact half-open byte intervals
  to bounded full/preloaded slice indexes; supports EOF and empty Blob.
- ViewportSliceController adds navigateBytes/navigateLines.
  - navigateLines: Hub -> VirtualLineIndex.range -> bytePlan
    -> Loader/Registry pipeline.
  - navigateBytes: bytePlan -> existing Loader/Registry pipeline.
- Register VirtualLineIndex in live UI only as OCDA infrastructure.
  The main textarea is NOT yet bound to the virtual viewport.

## Security / integrity / resource assessment
- All endpoints validate line IDs, indexes and maximum ranges.
- VTE errors: 400 invalid, 404 absent, 409 duplicate,
  416 line not found, 413 cache budget, 422 binary faults.
- Bytes scanned O(distance) until a target line is indexed;
  memory O(64 KiB + sparse checkpoints + resident slices).
- Checkpoint density 1/4096 lines, not per-line metadata.
- A large forward jump still scans preceding bytes once;
  fast scroll supersession and full PieceTree/B+ mapping pending.
- The editor remains capped by existing safe FileDocument logic.
- No third-party scripts, keys, absolute machine paths or file writes.

## EventChain / testing
- UI/VTE -> Hub -> VirtualLineIndex.open/locate/range
  -> LineAddressPolicy.scan -> OMU Log/Response.
- UI/VTE -> Hub -> viewport-slices.navigateLines
  -> Hub -> virtual-line-index.range -> Hub -> slice-loader.load
  -> Hub -> slice-registry -> OMU.
- Tests: Unicode, CRLF, EOF, 9000 lines, sparse checkpoints,
  byte-range boundary, empty file, invalid range, directed relations.
- Playwright existing editor/Plugin/File Tool regression remains
  mandatory. All CI checks must be green before merge.
