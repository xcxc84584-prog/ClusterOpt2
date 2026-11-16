# PR8 Patch(+8) — Plugin modal and legacy blocked-types parity

Status: awaiting CI. PR8 remains incomplete.

## Changes
- File > Tool > Plugin opens a native modal dialog, not nested menus.
- Responsive two-pane layout follows existing UI_COLOR tokens.
- Existing SliceRegistry limit/Off setting retains its HubUnit pathway.
- Disabled module entries explicitly represent unavailable runtimes.
- Added downloadable versioned API design specifications for
  SliceProcessor, EditCommitter and TextHighlighter.
- Restored legacy FileTypeManager replace API and inline edit control.
- Extension rename validates input, prevents duplicates (409),
  and returns 404 if the original extension is absent.
- Existing add/remove/reset/Explorer filter behavior remains.

## Architecture and Event Chains
UI.Plugin.open -> Dialog.showModal -> UI.Plugin.performance
-> HubUnit -> SliceRegistry.list/setLimit -> OMU.
UI.FileTypes.replace -> HubUnit -> FileTypeManager.receive
-> FileTypePolicy.normalize/sanitize -> EDPMU.BlockedFileTypes
-> Explorer refresh -> OMU.

## EHU and Relation Test
- 200 successful setting / extension update.
- 400 malformed extension or invalid memory limit.
- 404 missing old extension.
- 409 conflicting renamed extension.
- 413 cache budget restriction (existing SliceRegistry behavior).
- User requests route through HubUnit; no direct cross-object mutation.

## Risk and performance
- Modal DOM small; no full-document processing introduced.
- Plugin execution/import intentionally unavailable until sandbox
  capability validation, recovery and resource constraints exist.
- API downloads are documentation only, not executable runtimes.
- No key, filesystem absolute path, or embedded debug instruction.
- Existing editor still full-buffer; the new modal does not alter that.

## Verification
- Unit test added for file-type replacement and EHU.
- Browser test updated for modal, language, keyboard close and zoom.
- Do not merge before CI green and pre-merge main snapshot.
