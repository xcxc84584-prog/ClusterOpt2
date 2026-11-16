# PR8 Patch(+9) — Plugin category layout and legacy File Tool parity

Status: pending CI and visual acceptance; PR8 overall NOT PASS.

## Baseline / research
- Previous main: c20e3955bcd08c7829a96c9f0c731bc80f3bfe95.
- Compared old ClusterOpt Program/src/main.js and
  Program/src/file-type-blocklist.js.
- UI reference: VS Code Extension Marketplace category/details model.
- Uses native HTML dialog focus/backdrop behavior.

## Changes
- The Plugin dialog has a stable four-category navigation:
  Performance, Text Highlighter, Slice Processor, Edit Committer.
- Each category shows its own panel; unfinished runtimes remain
  explicitly unavailable, but API documents are accessible.
- No simulated install/enable toggles or unsupported code execution.
- Palette tokens and responsive layout are used on narrow screens.
- File Tool blocked list uses the original compact pencil and cross
  controls, original prompt-based rename flow, and localized status.
- Rename/rejection continues to route via Hub -> FileTypeManager;
  existing add/remove/reset, persistence and Explorer filters remain.

## EventChain / relation
UI.Plugin.category -> local panel state only.
UI.Plugin.performance -> Hub -> SliceRegistry.setLimit -> OMU Log/EHU.
UI.BlockedFileTypes.rename -> prompt -> Hub -> FileTypeManager.replace
-> FileTypePolicy -> EDPMU.SharedProperty -> Explorer refresh.
OCDA remains intact: objects own APIs; properties own algorithms.
Invalid extension: 400; duplicate rename: 409; valid rename: 200.

## Security/performance
- No third-party module execution or dynamic code injection.
- All extension text is rendered via textContent.
- Browser prompt cannot perform file access; policy validates output.
- Dialog renders only constant-size panels and list rows.
- Main editor still full-buffer, not a completed sliced editor.

## Validation
- Browser tests cover category switching, API links, palette,
  responsiveness and legacy icon actions/error feedback.
- Full CI and visual acceptance are required before merge.
