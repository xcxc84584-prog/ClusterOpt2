# PR4 Plan — Patch(+1): OCDA SOP foundation

Status: IN PROGRESS / NOT PASS. PR1–PR3 PASS are user-reported acceptance, not a claim that PR4 has passed.
Baseline: ClusterOpt2 main at the start of PR4; original UI and reference behavior: https://xcxc84584-prog.github.io/ClusterOpt/ .

## Scope and order
1. Establish the mandatory extensible development environment and PRD → Plan → ArcD → Implementation + Relation Test → Project pipeline.
2. Fix PR3 browser/version consistency before accepting PR4. Diagnose Pages deployment, HTTP cache, service worker, URL parameters, and LinkCore SystemVersion.
3. File > Tool > Close All; unsaved documents need a safe confirmation policy.
4. Tab long-press and left-drag reordering; click must still activate and close button must still close.
5. Shared StoragePriority policy: ExternalFirst / InternalFirst, with disk change detection and explicit conflict behavior.
6. Add tests, amend Plan/ArcD/Patch/handoff after every implementation patch.

## Reuse requirement
Do not redesign the UI. Reuse ClusterOpt's existing markup, CSS, event names, and behavior wherever possible.
Port/adapt narrowly where the legacy code conflicts with OCDA; never copy opaque dependencies, secrets, or unreviewed executable code.
No new framework or independently styled replacements without recorded justification.

## PR4 acceptance examples
- With three tabs A/B/C, move C to front; document identity, content, active selection and order stay correct.
- Close All with no dirty tabs closes everything; dirty tabs require confirmation and cancel preserves data.
- ExternalFirst: external overwrite triggers refresh and discards internal edits *only as specified*; warn of data loss before enabling.
- InternalFirst: external overwrite preserves in-memory edits, marks dirty/conflicted and allows a deliberate save overwriting external data.
- Missing permissions / deleted source / concurrent edits produce an EHU FAIL and red progress status; no silent loss.
- Chrome and Edge load the same deployed SystemVersion after normal update checks. Verify separately from browser-local preferences.

## Architecture and knowledge
Read global property registry first. Inspect FileWorkspace, FileDocument, HubUnit, URU, EDPMU, OMU, Language, UI_COLOR.
Review existing ClusterOpt implementations before changing each feature; cite upstream commit/file in each implementation patch.
External references: MDN File System Access API, browser Service Worker lifecycle, GitHub Pages deployment/caching, pointer event behavior.

## Security and data integrity
No hard-coded credentials or absolute machine paths. Browser file access must originate from explicit user gestures.
Never overwrite an external change without an explicit selected policy and suitable permission.
Loss-sensitive actions must support cancel, and must not silently erase dirty data.
Do not turn VTE simulation into real filesystem writes.

## Load and parallelization
Tab reorder is in-memory O(n) UI update; no file I/O.
Close All is a bounded sequential operation for confirmations, with separate independently scheduled unregistration.
External file checks must be throttled and cancelable; do not poll each editor tab every animation frame.
Parallel file operations are permitted across independent document IDs, but each file's load/edit/save must preserve per-file FIFO through HubUnit.

## Test gate
npm run check; npm run test:e2e; test UI in Chrome/Edge; inspect VTE and OMU log/error paths.
Record exact commit SHA, commands, PASS/FAIL counts in Patch; a document-only patch is never a functional PASS.

## Patch(+2) implementation
- Reused the existing File menu and Tools submenu. Added only Close All button.
- FileWorkspace owns Close All and tab reordering; no unnecessary new Object.
- Close All prompts once if ANY document is non-SYNCED. Cancel is atomic.
- Native HTML drag/drop transports original index; HubUnit routes reorder.
- Tests added for cancellation, unregister, ordering and Chrome UI behavior.
- StoragePriority and external-change detection remain TODO, not accepted.
- Revised roadmap: PR5 edit experience, PR6 Explorer, PR7 Explorer polish,
  PR8 sliced large files, PR9 go-to-line, PR10 PowerShell.
- CI + browser results must be captured before merging to main.

## Patch(+3) implementation (pending validation)
StoragePriority is the centrally registered Public Property:
`internal` (default) or `external`, from StoragePriority.js.
FileWorkspace owns setPriority/syncExternal and restores browser preference;
FileDocument owns per-file metadata fingerprint and reconcile Request/Response.
A bounded 3000ms active-tab poll and focus/visibility refresh probe external
changes. Saves perform preflight reconciliation before creating a writer.
ExternalFirst reloads source bytes; InternalFirst preserves local text and
marks the document dirty. File revision fingerprint uses size + lastModified;
known residual risk: changes preserving both fields are not detected.
No duplicate custom window layout; two existing Tool-menu style buttons used.
Security: avoid silent overwrites outside selected mode, preserve permissions;
invalid priority is 400; read errors propagate to EHU and red status.
Parallelism: per-file operations are serialized in HubUnit; independent
reconciles overlap across files. Each focus poll has one active guard.
Tests were authored but execution and Chrome/Edge acceptance are pending.

## Patch(+4) Legacy File menu restoration
Compared against ClusterOpt Program/index.html v0.0.69 and the original
Program/src/style.css. Keep New/Open/Save/Save As/Close Tab in the
original order and restore Close All in the File menu.
Retain the PR4 Tool -> Close All entry requested by the user.
Restore the legacy Tool menu order: Language, Highlighter, Palette,
Blocked File Types, storage-priority label and select.
The Highlighter and Blocked File Types entries are disabled until
PR5 / PR7 functionality exists, never deceptive functional placeholders.
StoragePriority is still one shared LinkCore Property and is changed via
the original select, not multiple custom buttons.
Changing language also updates the select label/options without
changing the selected priority. No new UI component/style framework.
Acceptance: legacy order, shared priority, zh-Hant/en translations,
Close All cancel and tab reorder unchanged, and Chrome/Edge validation.
