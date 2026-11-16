# Patch(+4) — legacy UI integration and PR1 workflow completion

## Corrections
- Reuse the full original ClusterOpt stylesheet and align the HTML shell,
  header, file menu, tab bar and editor to the legacy layout.
- Version label now comes from LinkCore rather than hard-coded HTML.
- File pickers run inside user gestures before asynchronous Hub routing.
- FileDocument and FileWorkspace use explicit OCDA descriptors.
- URU validates strict contracts and records register/unregister events.
- AccessPolicy and ParallelExecutionPolicy live in separate Property files.
- HubUnit is the gateway for property registration and property reads.
- Add VTE sandbox and user-inspection methods for objects and subobjects.
- Load multiple independent selected files concurrently using Hub scheduling.
- Save in bounded output chunks and report operation progress.
- Preserve BOM and CRLF on UTF-8 file round-trips; invalid encodings fail.
- Add tests for file I/O, isolation, authorization, subobjects and progress.

## Capacity
PR1 supports documents up to 64 MiB to prevent accidental whole-file
memory exhaustion. PR7 will introduce large-document virtualization.
Default scheduler runs 4 requests concurrently with a queue cap of 1024.

## Security and correctness
- No generated keys or absolute filesystem paths.
- Unauthorized callers receive HTTP-style 403.
- Browser file capabilities are obtained only from user-initiated pickers.
- No automatic background write of selected user files.
- Outstanding: deadlock guard for nested cross-object request cycles,
  true Worker parallelism, full editor browser E2E and compatibility review.

## Verification
Node.js tests are submitted to GitHub Actions. Acceptance remains pending
until the latest CI and browser smoke tests have been verified.
