# PR8 Patch(+21): viewport coordinate recovery

## Purpose
Preserve the user's physical viewport position, not caret/selection.
The goal covers document switching, reload and successful virtual Save.

## Implementation
- FileWorkspace snapshots vertical and horizontal pixel coordinates.
- RecoveryPolicy validates optional scrollLeft for older snapshots.
- Main editor restores scrollTop/scrollLeft when switching documents
  and synchronizes scrollLeft when scrolling.
- After virtual page data loads asynchronously, restored viewport
  pixel coordinates replace loadPage's default scrollTop=0.
- A successful virtual Save similarly preserves viewport coordinates.
- Virtual page index remains part of the existing recovery snapshot.

## EventChain
UI.scroll -> FileWorkspace state -> SessionRecovery.persist ->
IndexedDB snapshot -> SessionRecovery.restore -> workspace.restore ->
VirtualFileDocument.loadPage -> viewport repaint

## Limits
Pixel coordinates are clamped by browser scroll range, which can
change when fonts/zoom/line wrapping change. Exact line anchoring
across zoom requires follow-up automated browser acceptance.
No caret coordinate is used to reconstruct physical scroll location.

## Status
IMPLEMENTED ON FEATURE BRANCH — BROWSER ACCEPTANCE OPEN.
