# PR8 Patch(+25-Fix2) — Background File Permission Reconcile

## Reproduction
- Cluster.log() EHU Response.reconcile 500 with DOM NotAllowedError
  "getFile" cannot run without permission/user activation.
- Workspace polls all handles each 3 seconds while tab is visible.
- The former FileDocument.reconcile catch marks the document ERROR,
  even if there were valuable unsaved edits, and retries every poll.
- User observed version 0.0.8-pr8.patch24.fix1. GitHub main already
  publishes 0.0.8-pr8.patch25.fix1, so the observed page's actual
  URL, active tab module instance and cache must be checked.

## Implementation
- Workspace.syncExternal uses queryPermission({mode:"read"}) silently.
  If permission is not granted, skip I/O without invoking getFile or
  requesting a permission dialog during background polling.
- For handles without queryPermission(), a single denied getFile marks
  accessBlocked; subsequent polling skips until reauthorization.
- On a newly selected matching file handle, Workspace.open replaces
  the handle for that existing tab, preserving in-memory edits and tab.
- FileDocument.reconcile detects NotAllowedError and pauses access
  without overwriting status, text, revision or stored journal.
- VirtualFileDocument.reconcile uses equivalent permission handling,
  preserving piece-tree and dirty recovery checkpoints.
- Successful load/save/reconcile clears accessBlocked.
- LinkCore centrally publishes 0.0.8-pr8.patch25.fix2.

## Event chain / EHU
UI.timer -> HubUnit -> Workspace.syncExternal -> handle.queryPermission
-> (granted) HubUnit -> FileDocument.Request.reconcile -> getFile
-> FileDocument.Response.reconcile -> OMU.
Denials while polling are an expected paused state and do not emit
repeated EHU 500. Actual unexpected I/O exceptions retain EHU failure
paths. Manual Save still reports a failure if authorization is denied.

## Security and resource limits
- No automatic requestPermission() during timers, no elevation,
  no file content submitted to a network endpoint.
- Permission probe overhead once per file per existing 3s poll.
- The UI and existing file state are unchanged when read access is lost.

## Tests / acceptance
- queryPermission=prompt: no getFile, preserve yellow/dirty text.
- no queryPermission: first NotAllowedError pauses all future probes.
- re-open same physical handle: activate existing tab, no duplicate.
- Existing Node/Chromium tests remain accepted only with CI PASS.
- For live old-version tab, verify location.href and no-store fetch of
  LinkCore.js under the actual page origin; do not guess which site
  or browser cache is serving the script.
