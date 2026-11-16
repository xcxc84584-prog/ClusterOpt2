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

## Browser relation checks
Create -> Explorer.list -> row; query filters rows; click row ->
Explorer.activate -> Workspace.activate; browser asserts no duplicates.

## Patch(+3) — UI event chain
User click ExplorerToggle -> DOM adapter -> visibility (no cross-object).
UI -> HubUnit -> Explorer.list -> HubUnit -> Workspace.list -> DOM tree.
User import folder -> authorized showDirectoryPicker -> HubUnit
-> Explorer.importFolder -> root handle registration.
Directory traversal and persistent trees remain outstanding.

## Patch(+4) Event Chain
UI -> Hub -> Explorer.importFolder -> FileSystemHandle.values -> roots
UI -> Hub -> Explorer.expand -> FileSystemHandle.values -> tree
UI -> Hub -> Explorer.refreshTree -> collapse tree
UI -> Hub -> Explorer.list -> Hub -> Workspace.list -> UI
All failures are observed by OMU; no direct workspace mutation in Explorer.

## Patch(+5) Event chain
Explorer.list -> Hub -> Workspace.entries -> Explorer.project -> one tree
Explorer.openEntry -> Hub -> Workspace.open / activate -> Document.load
Folder and editor identity joined by FileSystemHandle.isSameEntry.
EHU failures: invalid file 404; handle access/loading failures 500/413.

## Patch(+6) Event chain
UI -> Hub -> SessionRecovery.persist -> Hub -> Workspace.snapshot
-> Hub -> Explorer.snapshotRoots -> IndexedDB transaction.
Startup -> Hub -> Recovery.restore -> IndexedDB -> Hub ->
Workspace.restore -> Hub -> Explorer.restoreRoots -> UI render.
EHU: 400 bad schema, 409 duplicate restore, 413 too large,
503 IndexedDB unavailable; no snapshot overwrites on errors.

## Patch(+7) Event Chain
UI timer -> Hub -> Explorer.syncExternal -> expanded handle.values()
-> compare children -> UI redraw only when different.
SessionRecovery.restore -> Explorer.restoreExpansion(paths).
Explorer panel/search/tree scrollbar use sessionStorage (no handles).

## Patch(+8) regression event
UI.edit/scroll -> Recovery.persist -> IndexedDB -> reload ->
Recovery.restore -> UI render -> scrollTop restored, one tab.

## Patch(+9) recovery event chain
Recovery.persist -> IndexedDB commit -> sessionStorage(text only).
Recovery.restore -> IndexedDB or sessionStorage fallback -> Hub ->
Workspace.restore; imported roots need IndexedDB and permission.
