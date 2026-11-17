# PR12 — Plugin Marketplace and Save/Discard Close

## PRD
1. Unsaved document close asks "是否存儲". Yes saves then closes;
   No closes without saving; a cancelled picker or failed write preserves tabs.
2. Remove the sample plugin preview / test-plugin UI from Resources.
3. Resources right pane lists verified downloadable plugin packages
   with a live search, explicit local download and native local file chooser.
4. Re-layout Plugin Manager and Resources without overlapping panels.

## Architecture and constraints
- Preserve current HubUnit, URU, OMU, ACL and API contract model.
- Only reviewed package sources are executable; a locally selected JS
  file is byte-checked against the bundled reviewed source.
- Do not evaluate user-supplied local JavaScript with import(), eval(),
  blob URLs, innerHTML or a host-global Function constructor.
- The catalogue does not silently discover arbitrary plugin scripts.
- Keep both Resources panes independently scrollable.
- Continue using global UI_COLOR and Language properties.
- Keep release 0.0.13 while PR12 is a draft; use one release gate.
- Close operations preserve external-write reconciliation and dirty
  content when the save fails.

## References
- Visual Studio Code Extension Marketplace documentation:
  https://code.visualstudio.com/docs/configure/extensions/extension-marketplace
- VS Code local VSIX installation pattern (download, select local file,
  explicit user confirmation) — concept only, not VSIX compatibility.

## Performance and threat assessment
- Marketplace listing is an in-module frozen, bounded trusted catalogue.
- Search is linear in catalogue size; no remote search or background
  installer. Source-size bound: 256 KiB for the reviewed JS file.
- Native file picker selection cannot expose arbitrary local paths.
- One package's content is compared to the hosted reviewed package,
  then the hosted trusted module registers with HubUnit.
- Conflicting external edits must not be overwritten silently.

## Tests
- Browser: search catalogue / file picker / valid selected download /
  modified JS rejection / no visible test plugin.
- Node: dirty close Yes / No, rollback on unsuccessful save, root-close
  dependencies, existing OCDA and registration suites.
- Final CI and actual FileSystemAccess manual acceptance must be
  checked before release and merge.
