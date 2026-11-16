# PR5 Patch(+1) — Editing Behavior Foundation

Status: implemented on feature branch, pending complete integration tests.
Date: 2026-11-16

## Safety and baseline
Created `backup/pre-pr5-20261116` from main BEFORE PR5 changes.
Feature branch: `pr5/editor-interaction-patch1`.
No force push, no rewrites of older PR1–PR4 commits.

## Changes
- Removed duplicate Tool > Close All button. Original File main-menu
  Close All (#closeAllMain) remains unchanged.
- Created EditorInteractionPolicy as global immutable LinkCore Property
  in one separate source file. Transforms paired punctuation, Tab,
  Backspace indentation groups, Enter autoindent and viewport tab guides.
- MainUI retains existing textarea; routes input through HubUnit
  Request.edit, preserving old FileDocument/Workspace logic.
- Tab guides reuse the original #editorPane styling and only inspect
  visible lines + small guard range (max 160 lines).
- Added isolated unit tests and Playwright regression tests.
- Rewrote obsolete PR4 e2e assertions expecting duplicate Tool Close All.

## Review and limitations
Static local algorithm assertions passed (11 checks prior to integration).
No CI green run or real Chrome/Edge keyboard/undo verification yet.
Known: setRangeText may not have native undo parity; do not mark PR5 PASS.
Guide first-line seek still O(number of lines above viewport), to be
addressed in PR8 indexed virtualization.

## Next
Run tests, fix regressions, benchmark and then decide main merge.
Future separate patches should add language-aware indentation rules,
precise undo transaction handling, and broader keyboard support.
