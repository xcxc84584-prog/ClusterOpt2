# PR14.3 Patch(+2) — Palette, workbench isolation and test repair

## Repairs
- Host UI now tracks global palette CSS tokens through a read-only
  postMessage payload. Sandboxed UI validates color values with CSS.supports
  before applying local style variables.
- When a user selects another editor tab, plugin manager or PowerShell,
  plugin UI panel hides without removing or modifying other components.
- Fixed stale PR14.2 assertion after introduction of uiEntry=index.html.
- Added Chromium failed-upgrade-restore case: a malformed Worker must
  leave the original Provider and UI available.

## Review and guard
- Reviewed prior Provider Registry failure: stale test expected undefined
  uiEntry; actual index.html. Patched in PR14.3.
- No run is considered PASS until all checks on the *latest head* succeed.
- CI workflows of superseded commits may be cancelled to avoid duplicates.
- No backend, Explorer, shell or HubUnit behavior modified.

## Remaining gaps
- True end-to-end old AI Agent features remain PR14.4–14.10.
- Additional security acceptance: malicious iframe postMessage attempt,
  user selection under competing workbench view, reload and local pairing.
- A plugin UI is an optional isolated view, not unrestricted host DOM API.
