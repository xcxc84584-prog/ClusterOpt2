# PR7 ArcD — Patch(+1)
## Object changes
Explorer: closeRoot Request/Response.
FileWorkspace: closeMany Request/Response.
Main UI: legacy context menu adapter only.

## Event chain
UI.contextmenu -> Hub -> Explorer.closeRoot -> root.resolve(file handle)
-> Hub -> Workspace.closeMany -> single confirm -> unregister tabs
-> Explorer removes root -> UI rerender.

## EHU
| Event | PASS | FAIL |
| --- | --- | --- |
| Explorer.closeRoot | 200 | 404 unknown root / 503 identity unavailable |
| Workspace.closeMany | 200 | 400 invalid ids |
| User cancel | 200 false | No mutation |

## Patch(+2) source integration
PR6 SessionRecovery and fallback remain unchanged; PR7 adds only
UI/context actions, close-root handling and zoom CSS.

## Patch(+3) Object / Property / Event Chain
Object: FileTypeManager (add/remove/reset/list).
Properties: FileTypePolicy, BlockedFileTypes.
UI -> Hub -> FileTypeManager.add -> Hub.Property.BlockedFileTypes
-> Explorer.list -> FileTypePolicy.blocked -> UI projection.
EHU 400 invalid extension, 503 storage unavailable. No deletion.

## Patch(+4) event chain
UI.drag -> Hub -> Explorer.reorder -> ExplorerOrderPolicy.move
-> SessionRecovery.persist -> IndexedDB -> Explorer.restoreRoots
-> ExplorerOrderPolicy.ordered. Unattached tab: Explorer ->
Hub -> Workspace.reorder -> SessionRecovery.persist.
EHU 400 cross-root or invalid sibling; 503 storage failure.
