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
