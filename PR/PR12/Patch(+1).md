# PR12 Patch +1 — UI, close flow and marketplace

## Modified
- Implementation/object/FileWorkspace.js: explicit Save/Discard
  semantics, save-first, preserve on failed Save, external reconciliation.
- Implementation/main/main.js: obtain choice and Save As destination
  before asynchronous Hub dispatch.
- Implementation/property/Language.js: localized choices.
- Implementation/main/plugin-resource-view.js: remove test-plugin UI,
  replace path list with searchable downloadable plugin cards and a
  user-selected local file mount verified against trusted bundled source.
- Implementation/main/style.css: responsive independent scroll panes.
- Implementation/tests/pr4-workspace.test.js and
  Implementation/tests/pr7-close-root.test.js: update changed semantics.
- Implementation/e2e/pr12-plugin-marketplace.spec.js: browser acceptance.

## Safety
Untrusted plugin files remain non-executable. This is a reviewed-file
loader, not a general third-party JavaScript runtime.

## Pending
Check final green CI gate and create a restore branch before merging.
