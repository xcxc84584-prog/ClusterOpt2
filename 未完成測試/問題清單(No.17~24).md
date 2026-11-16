# ClusterOpt2 — Pending PR8 tests No.17–24

All entries OPEN until verified. PR8 remains NOT PASS.

| No. | Priority | Test / limitation |
| --- | --- | --- |
| 17.1 | P0 | CI and VTE/Playwright PASS on PR19 head; manual acceptance OPEN |
| 17.2 | P0 | File byte replacement, UTF-8, CRLF, prefix/suffix |
| 17.3 | P0 | Stale mtime/size/source-region SHA-256 -> EHU 409 |
| 17.4 | P0 | Stream failure/abort -> persistent journal retained |
| 17.5 | P0 | Readback error / truncated file -> EHU 422 and dirty |
| 17.6 | P0 | Atomic journal retirement version/checksum CAS |
| 17.7 | P0 | Hub Request/Response, EHU, OMU/Dependency 10/01 |
| 17.8 | P0 | Chromium OPFS E2E PASS; external selected-file permission tests pending |
| 17.9 | P0 | OS/external file race and browser interruption |
| 17.10 | P1 | Full-file write amplification/large-file performance |
| 18.1 | P0 | Piece Tree/B+ and UTF-16/UTF-8 editor integration |
| 19.1 | P0 | Virtual editor renders only visible slices |
| 20.1 | P1 | Parallel per-slice HubUnit and race cancellation |
| 21.1 | P1 | Extensible text highlighter Plugin |
| 22.1 | P1 | SliceProcessor and EditCommitter Plugin |
| 23.1 | P0 | Crash-safe full six-layer recovery |
| 24.1 | P0 | 1 GiB / 5 GiB performance + final PR8 acceptance |

## Recovery safety
No user-visible writeback UI in Patch17; old editor save untouched.
Failure or ambiguous commit retains journal, except successful verified
retirement after exact checkpoint CAS. Backup main before any merge.
