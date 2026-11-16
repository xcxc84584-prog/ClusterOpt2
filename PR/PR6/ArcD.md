# PR6 ArcD — Patch(+1)
## New Object
Explorer: list, create, open, activate (User API and Responses).
Workspace: list read-only Request/Response.

## New Property
FileManagement: summarize / normalizeQuery / filter; registered by
LinkCore and shared by FileWorkspace and Explorer.

## Abstract event chain
UI -> HubUnit -> Explorer.list -> HubUnit -> FileWorkspace.list
-> FileManagement.summarize -> Explorer.filter -> UI projection

UI -> HubUnit -> Explorer.activate -> HubUnit
-> FileWorkspace.activate -> UI render

Each hop records EHU/Log/Dependency through OMU. Independent file
I/O remains parallel where allowed; workspace mutations remain FIFO.

## EHU table
| Event | OK | FAIL | Expected action |
| --- | --- | --- | --- |
| Explorer.list | 200 | 404/500 | Emit EHU; leave previous view |
| Explorer.activate | 200 | 400/500 | Emit EHU; preserve active tab |
| Explorer.invalid | none | 400 | Emit EHU; no mutation |
| Workspace.list | 200 | 403/500 | Emit EHU; block unauthorized action |

## Relation matrix
UI -> Explorer: 10
Explorer -> Workspace: 10
Workspace -> Explorer: 01
Explorer <-> FileManagement: shared immutable property
