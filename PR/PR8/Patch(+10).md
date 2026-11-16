# PR8 Patch(+10) — Workbench Plugin Tool Window

Status: in validation. PR8 overall remains incomplete.

## User request
- Replace File > Tool > Plugin modal with a non-document workspace window.
- Share the editor tab strip and tab lifecycle, including open/activate,
  close and drag-to-reorder; preserve document cursor/text state.
- Place category selection **inside the Plugin window at its top-right**,
  not in the global header or a modal.
- Fixed, noneditable tool UI; only configuration controls are writable.
- Run VTE relation/EventChain tests and GitHub Actions CI.

## Prior art
- VS Code Workbench editor tab/group model and settings editor.
- Compact header toolbar in modern VS Code Workbench.
- Preserve original ClusterOpt color tokens and tab appearance.
References:
https://code.visualstudio.com/docs/editing/getting-started/userinterface
https://code.visualstudio.com/docs/configure/custom-layout

## Implementation
- New ToolTabManager OCDA Object: open/activate/deactivate/close/move/list.
- New ToolTabPolicy shared Property: canonical tool ID and tab order.
- Reuse #tabs as a unified projection of file document and tool tabs.
- FileWorkspace remains sole owner of actual file documents.
- Plugin content is mounted as #pluginWindow inside #workspace.
- Plugin category buttons are in #pluginWindow's own header right region.
- Current SliceRegistry memory budget continues to work through HubUnit.
- Plugin execution remains disabled; API standard downloads preserved.
- Existing blocked-file-type dialog remains unaffected.

## EventChain / EHU
UI.Plugin -> HubUnit -> ToolTabManager.open -> ToolTabPolicy -> OMU.
UI.Tab.Tool -> HubUnit -> ToolTabManager.activate/move/close -> OMU.
UI.Tab.Document -> HubUnit -> ToolTabManager.deactivate -> HubUnit
-> FileWorkspace.activate -> OMU.
UI.Plugin.Performance -> HubUnit -> SliceRegistry.setLimit -> OMU.
Success 200; missing tool tab 404; bad operation/index 400.
VTE compares directed dependencies Request=10, Response=01.
All ToolTabManager operations remain resource-key serialized.

## Resource and security assessment
- Tab projection O(number of open documents), existing pattern.
- Tool window has constant panel count and does not decode file data.
- No extra FileDocument, filesystem handles or untrusted JavaScript.
- Plugin view never enters file recovery snapshots as a document.
- Main editor still reads whole documents; universal piece-tree backed
  virtual editor is NOT integrated in this patch.
- Recovery of Plugin tool-tab state across reload is not yet enabled.
- UI does not expose test instructions or fictional plugin activation.

## Validation
- Unit VTE lifecycle, EventChain, EHU failure, tab-order projection.
- Playwright opens/switches/closes tool tabs and protects unsaved text.
- Browser checks top-right region relative to the tool window bounds.
- Browser checks narrow layout, language, Plugin budget and file types.
- Require green npm run check and npm run test:e2e before merge.
