# PR8 Patch(+24-Fix1) — Bounded parallel preloads and correct residency

## Purpose
Complete the safely testable Patch22–24 cache and I/O work without
misstating remaining full-document migration or stress gates.

## Implementation
- SliceLoader.loadBatch reads 1–4 Blob slices concurrently using Promise.all.
  Independent slice reads overlap, while registry admission is serialized
  to preserve bounded memory accounting.
- The result includes only slices resident AFTER batch completion. Earlier
  speculative slices evicted by later admissions are classified as skipped.
- Full batches reject budget exhaustion (413); preloaded batches may skip
  optional slices on 413 without treating a missing cache as a file error.
- ViewportSliceController uses batched prefetch with deterministic ordering.
- It remembers denied preloads for an unchanged viewport and budget; when
  memory policy changes, the skipped slices are retried.
- SliceRegistry prevents speculative preloads from replacing a full slice.
- Workspace exposes the versioned slice manifest through UserAPI, retaining
  explicit legacy-compatibility mode for small files.

## OCDA Event Chains
UI/Observer -> HubUnit -> viewport-slices.navigate -> HubUnit ->
slice-loader.loadBatch -> UTF8SlicePolicy.read x <=4 concurrently ->
HubUnit -> slice-registry.registerVirtual/load/list -> OMU -> response.

Errors:
- EHU 400 malformed batch, duplicate/out-of-range indices.
- EHU 413 full chunk blocked by pinned/dirty residency.
- Optional preload 413 is returned as skipped, not false completion.
- EHU 422 invalid UTF-8 and EHU 409 cancelled batch.
No direct cross-Object SendTo and no API keys.

## Load assessment
- At most 4 * chunkBytes additional decoded chunks in flight.
- Default chunk size is 64 KiB; max 1 MiB per slice.
- No full-file read is required by the loader for a distant byte jump.
- Synthetic 5 GiB Blob random index test checks that byte reads are
  bounded without allocating 5 GiB of real memory.
- This is NOT real 5 GiB disk I/O, Worker CPU parallelism, nor a
  complete runtime replacement of the legacy FileDocument.

## Tests
- Parallel batch decoding, prefetch budget and final-resident response.
- Full batch fails on memory limit when preceding full slice is pinned.
- Repeat denied preloads do not trigger repeated reads under same limit.
- Changing limit enables retry.
- Full cache cannot be downgraded by a speculative preload.
- 5 GiB synthetic random byte jump and controlled residency.
- Previous PR1–PR7, PR8 E2E, VTE and CI must remain PASS.

## Acceptance
Staged compatibility milestone. PR8 overall NOT PASS until:
- All file sizes use one authoritative sliced editing model.
- Real Windows 1 GiB/5 GiB disk and crash tests run successfully.
- Worker CPU preprocessing and rapid-scroll benchmarks are measured.
