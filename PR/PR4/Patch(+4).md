# PR4 Patch(+4): Restore ClusterOpt legacy File menu

Date: 2026-11-16
Status: IMPLEMENTED, ACCEPTANCE PENDING.

## Recovery
Before edits created backup/pre-pr4-menu-restore-20261116 from main.
Original earlier recovery backup/pre-pr4-20261116 is also retained.
Do not force-update or delete either backup.

## Grounded original reference
ClusterOpt Program/index.html v0.0.69: File menu has
New/Open/Save/Save As/Close Tab/Close All, then Tool submenu.
The original Tool submenu includes Language, Highlighter, Palette,
Blocked File Types and a single storage-priority select.
ClusterOpt Program/src/style.css already has #priority and
.priority-heading styles; ClusterOpt2 retains these in legacy CSS.

## Changes
- index.html: restore original File menu order, Close All main entry,
  Tool submenu's highlighter/blocked entries and original #priority select.
- Keep additionally requested Tool > Close All, invoking same action.
- MainUI: map original #priority to LinkCore setPriority via HubUnit;
  both Close All entries invoke existing closeAll.
- Language: bilingual menu, priority label and option text.
- Unsupported PR5 highlighter/PR7 blocked-type UI is disabled, not
  incorrectly represented as functional.
- New browser test: Implementation/e2e/pr4-legacy-file-menu.spec.js.
- Updated Plan, ArcD, numbered issue list and latest handoff.

## Scope restrictions and acceptance
No custom visual redesign; no replacement of FileWorkspace,
storage policy engine or core editor. Legacy stylesheet reused.
Syntax/code and browser tests must be verified on final head.
PR4 is NOT PASS until UI behavior is accepted in Chrome/Edge.
