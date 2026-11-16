# PR4 Patch(+2) — Close All / Tab Reorder

Date: 2026-11-16
Status: IMPLEMENTED ON REVIEW BRANCH; CI/BROWSER ACCEPTANCE PENDING.

## Recovery before implementation
Created `backup/pre-pr4-20261116` from main, prior to modifying functionality.
Restore using GitHub branch/commit comparison; never force reset a live main silently.

## Source changes
- index.html: add Close All inside original File > Tool submenu.
- Implementation/object/FileWorkspace.js:
  - Request/Response/UserAPI add closeAll, reorder.
  - closeAll() asks once if unsaved documents exist; cancellation is atomic.
  - reorder(from,to) preserves IDs, contents and active tab; rejects invalid indices.
- Implementation/main/main.js:
  - Integrates existing UI tabs with native drag/drop through HubUnit.
  - Connects Close All button through FileWorkspace Request.
- Implementation/property/Language.js: add bilingual strings.
- Implementation/main/language-ui.js: bind Close All to shared Language.

## Tests added
- Implementation/tests/pr4-workspace.test.js
- Implementation/e2e/pr4.spec.js
Test assertions: dirty cancellation; accepted close; tab reordering; bilingual label.
No claim that npm check or Playwright passed yet; require CI evidence.

## Event chain and security
UI > HubUnit > FileWorkspace > OMU.
Invalid reorder indices: RangeError with HTTP-like EHU 400.
A dirty document cannot be bulk-closed without an affirmative prompt.
No new UI style system; legacy CSS reused. No machine paths or keys added.

## Still outstanding
- PR4 StoragePriority: ExternalFirst/InternalFirst and external overwrite detection.
- Cross-browser deployment consistency / cache verification.
- Runtime tests and browser-permission acceptance.
- Source baseline comparison and coverage gaps must be revisited before PR4 PASS.
