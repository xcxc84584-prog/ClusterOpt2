# PR5 Plan — Patch(+1) / Editor Interaction Foundation

Status: implemented in PR5 feature branch; browser and CI acceptance pending.
Baseline: backup/pre-pr5-20261116 from original main.
Target UI reference: ClusterOpt Program/index.html, Program/src/style.css.
No UI redesign or external framework replacement.

## PRD / examples
1. Type () <> "" [] {} and apostrophe: auto insert matching closer.
2. Selected text: surround with pairing characters and keep selection.
3. Type an existing closer: overtype instead of duplicating; paired
   Backspace deletes both when caret is between a pair.
4. Tab inserts one tab. Backspace after a tab deletes the entire tab;
   Backspace in leading spaces removes the prior 4-column group.
5. Enter inherits existing indentation. Enter after opening braces adds
   an extra indentation level; Enter between paired braces expands block.
6. Show tab guide only over visible viewport with bounded nearby lines,
   preserving the original ClusterOpt editor design.
7. No interference with IME composition, Ctrl/Alt/Meta shortcuts,
   clipboard paste, PR1 file loading/saving, PR2 UI_COLOR, PR3 Language,
   or PR4 StoragePriority.

## Reference knowledge
- Microsoft VS Code basic editing: editor.autoClosingBrackets /
  editor.autoClosingQuotes; defaults depend on language.
  https://code.visualstudio.com/docs/editing/codebasics
- Monaco LanguageConfiguration: autoClosingPairs, autoCloseBefore,
  indentationRules, onEnterRules and surroundingPairs.
  https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor_editor_api.languages.LanguageConfiguration.html
- Reference behavior, not a wholesale Monaco integration: preserving
  ClusterOpt UI and existing OCDA file model is more important.

## Architecture / load
One immutable global EditorInteractionPolicy Property registered by LinkCore.
Existing MainUI is only a DOM adapter: it gets policy via HubUnit and
routes edits to FileDocument through the original HubUnit Request.edit.
No standalone new window object and no additional network request.
Transform uses O(length of current line/selection) for common actions,
excluding the text slice used by an existing textarea. Display of tab
guides is bounded to <=160 viewport/neighbor lines but first-line seek
currently scans from document start (PR8 will replace with slice index).
Only one requestAnimationFrame of overlay work may be queued.

## Risks and security
- Browser textarea setRangeText does not guarantee the same native undo
  semantics as VS Code; Ctrl+Z/redo requires explicit real browser tests
  and potentially a dedicated transaction layer before PR5 PASS.
- HTML textarea cannot provide full grammar-aware indentation.
  Angle brackets can conflict with comparison operators or JSX syntax;
  policy only auto-closes before safe next characters.
- Keep original File status, BOM/line endings and file handles intact.
- No passwords, hard-coded OS paths or arbitrary HTML execution.
- Existing PR1 <=64MiB documents remain unchanged; true huge text
  virtualization deferred to PR8.

## Acceptance gates
Run npm run check, npm run test:e2e on the latest branch, evaluate
undo/redo, IME, multi-file switching, indentation, shortcuts, overlays,
100KB/1MB/64MB performance and desktop/browser zoom.
Keep PR5 NOT PASS unless all required regressions are verified.

## Performance refinement within Patch(+1)
The guideWindow algorithm accepts an optional viewport anchor
(firstLine/offset) and seeks forward or backward from it. MainUI
invalidates the anchor on document changes and on switching tabs.
Consecutive scroll operations typically scan only changed visible
lines rather than all lines above the viewport.
Use the PR8 tree index for initial random jumping at large offsets.

## Patch(+1) undo compatibility refinement
Native `document.execCommand("insertText")` is preferred in supported
Chromium editors, with setRangeText fallback. The native path preserves
the browser undo buffer. This API is deprecated, so keep the fallback
and a mandatory future browser regression test.
Reference: https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand
Added browser test asserting Ctrl+Z and Ctrl+Shift+Z after auto-pair.
