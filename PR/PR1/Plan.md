# PR1 — Plan (Patch +2)

## Status
IN PROGRESS — architecture groundwork committed; not accepted.

## Scope
Editor creation/open/edit/save/close, tabs, line numbers, operation progress,
and a reusable OCDA development environment for later PRs.

## Standard process
PRD -> Plan -> ArcD -> Implementation + Relation Test -> Project.
Each patch must update Plan and ArcD and document known issues.
Before creating a property, read 全域屬性清單.md.

## Architectural strategy
- Runtime-only URU registration (cleared on page reload).
- HubUnit as the mandatory cross-object request/response gateway.
- EDPMU as the single property registry.
- OMU stores EHU, pass/fail, relation observations and HTTP-style status.
- Each object and property belongs to its own source file.
- Existing Document objects remain isolated behind receive(action, payload).

## Security / capacity
Unrecognized IDs do not execute. Only trusted predeclared factories
may auto-register. Never store keys or absolute file system paths.
OMU keeps the latest 2000 log entries in memory.
PR1 reads whole documents into memory; segmented loading is deferred to PR7.
Status percentages represent active operations, not loaded-file fraction.

## Validation
Node.js unit tests and syntax checks submitted to GitHub Actions.
Still required: browser E2E, access authorization enforcement, VTE,
explicit bidirectional relation probes and large-file safety evaluation.

## Patch history
- Patch(+1): editor prototype.
- Patch(+2): four LinkCore units, contract utility, tests and CI.

## Exit criteria
No PR1 completion claim before CI succeeds, browser I/O is tested,
required OCDA contract checks pass and outstanding blockers are resolved.

## Patch(+3): concurrent execution requirement
- Async requests to independent Object IDs may overlap (default limit 4).
- Requests addressed to the same Object ID are FIFO and mutually exclusive.
- The bounded queue rejects overload; abort can remove queued tasks.
- No CPU parallelism is claimed: Web Workers are a later opt-in extension.
- All work goes through HubUnit; clients cannot override lock/resource keys.
- Nested requests must not target the currently held object (deadlock risk);
  future patches should enforce reentrancy detection / call-graph validation.
- Cross-browser or multi-tab locks are NOT covered by this in-memory scheduler.
- Existing editor operations may still have UI races pending browser E2E.
- Test suite expanded for independent overlap, FIFO, max concurrency,
  queue overflow, cancellation and failure cleanup.
- Validation is submitted but not marked PASS.

## Patch(+4) accepted implementation scope
- The first PR focuses on small UTF-8 text files (up to 64 MiB).
- The visual interface uses the original ClusterOpt CSS and file-menu shell.
- File picker capability grants occur in the direct user event, before Hub.
- File content is edited through FileDocument.receive; saved as UTF-8.
- UTF-8 BOM and Windows CRLF are preserved across an unchanged round-trip.
- Concurrent opening of distinct files uses HubUnit scheduling.
- Request/Response for a target object remains FIFO serialized.
- Nested request cycles return EHU 423 instead of indefinite blocking.
- A bounded nested request pool avoids starvation under regular saturation.
- External file mutations and giant-file virtualization are deferred to PR4/7.

## Performance model
- One object can run a single active operation at any instant.
- Four normal operations can overlap, plus eight bounded nested slots.
- FIFO ordering applies independently to each object ID.
- PR1 file reader accumulates text in memory; above 64 MiB rejects with 413.
- Progress is the completion of the current file operation.
- Saved output is written in 256-KiB chunks after UTF-8 encoding.

## Security and reliability
- Only a direct user gesture obtains File System Access handles.
- No stored access tokens or absolute file paths.
- VTE creates a separate LinkCore in memory, with no shared files.
- Strict project Object descriptors require OCDA standard fields.
- HubUnit logs successful/failing registrations, requests and responses.

## Remaining release checks
- Browser-based DOM workflow / screenshot comparison to ClusterOpt UI.
- Multi-tab unsaved changes, permissions, reopening and keyboard shortcuts.
- User-agent identity spoof protection is not enforced at untrusted API boundaries.
- Browser single-page async scheduling is not cross-tab locking.

## Patch(+5) test strategy
- Use the exact original ClusterOpt stylesheet and original editor IDs.
- Keep only a narrow adapter for PR1 state, status and event binding.
- Run Node.js contract, relation, file and concurrency tests on every PR.
- Run Chromium Playwright tests on every PR for user-facing interactions.
- Headless file picker stubs exercise the UI route; manually test native
  filesystem permissions in Chrome before claiming complete acceptance.
- Browser regression checks focus on file operations and tab state,
  not deferred Explorer, syntax highlighting or PowerShell features.
