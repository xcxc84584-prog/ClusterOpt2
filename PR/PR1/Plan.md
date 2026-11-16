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
