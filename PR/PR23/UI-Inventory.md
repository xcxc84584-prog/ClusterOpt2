# PR23.1 — Native UI Inventory (static source audit)

Generated from this repository's index.html and Implementation JS.
This is **not** a complete runtime DOM inventory or API coverage PASS.

## Coverage

- Static HTML IDs: 86
- Duplicate static IDs: 0
- JS files scanned: 70
- Files containing dynamic DOM creation/insertion: 11
- Verified UISP API coverage: NOT YET AUDITED
- Browser-rendered and plugin-generated elements: PENDING

## Static UI elements

| HTML ID | Tag | Source | Literal JS getElementById references | UISP API |
| --- | --- | --- | --- | --- |
| app | div | index.html:15 | none found | Not verified |
| versionLabel | small | index.html:20 | Implementation/main/main.js | Not verified |
| explorerToggle | button | index.html:23 | Implementation/main/main.js | Not verified |
| explorerPowerShell | button | index.html:26 | Implementation/main/main.js, Implementation/object/PluginLocalAgentObject.js, Implementation/LinkCore/PluginWorkbenchTabUnit.js | Not verified |
| menuBtn | button | index.html:31 | Implementation/main/main.js | Not verified |
| menu | nav | index.html:33 | Implementation/main/main.js | Not verified |
| newFile | button | index.html:34 | Implementation/main/main.js | Not verified |
| openFile | button | index.html:35 | Implementation/main/main.js | Not verified |
| saveFile | button | index.html:37 | Implementation/main/main.js | Not verified |
| saveAsFile | button | index.html:38 | Implementation/main/main.js | Not verified |
| closeFile | button | index.html:40 | Implementation/main/main.js | Not verified |
| closeAllMain | button | index.html:41 | Implementation/main/main.js | Not verified |
| toolBtn | button | index.html:43 | none found | Not verified |
| toolOptions | div | index.html:45 | Implementation/main/main.js | Not verified |
| languageBtn | button | index.html:47 | none found | Not verified |
| languageOptions | div | index.html:49 | Implementation/main/main.js | Not verified |
| pluginBtn | button | index.html:57 | Implementation/main/main.js | Not verified |
| paletteBtn | button | index.html:61 | none found | Not verified |
| blockedTypesBtn | button | index.html:63 | Implementation/main/main.js | Not verified |
| priorityHeading | label | index.html:65 | none found | Not verified |
| priority | select | index.html:67 | Implementation/main/main.js | Not verified |
| clusterWorkspaceShell | div | index.html:76 | none found | Not verified |
| explorerPanel | aside | index.html:77 | Implementation/main/main.js | Not verified |
| explorerTitle | strong | index.html:79 | none found | Not verified |
| explorerClose | button | index.html:80 | Implementation/main/main.js | Not verified |
| explorerAddFolder | button | index.html:83 | Implementation/main/main.js | Not verified |
| explorerAddFile | button | index.html:85 | Implementation/main/main.js | Not verified |
| explorerRefresh | button | index.html:87 | Implementation/main/main.js | Not verified |
| explorerSearch | input | index.html:90 | Implementation/main/main.js | Not verified |
| explorerTree | div | index.html:93 | Implementation/main/main.js | Not verified |
| clusterEditorColumn | div | index.html:95 | Implementation/main/main.js, Implementation/LinkCore/PluginWorkbenchTabUnit.js | Not verified |
| tabs | div | index.html:96 | Implementation/LinkCore/PluginWorkbenchTabUnit.js | Not verified |
| workspace | main | index.html:97 | Implementation/LinkCore/PluginUIHostUnit.js, Implementation/LinkCore/PluginWorkbenchTabUnit.js | Not verified |
| empty | div | index.html:98 | none found | Not verified |
| emptyHint | p | index.html:101 | none found | Not verified |
| editorPane | div | index.html:103 | none found | Not verified |
| gutter | pre | index.html:104 | none found | Not verified |
| tabGuide | pre | index.html:106 | none found | Not verified |
| editor | textarea | index.html:107 | none found | Not verified |
| pluginWindow | section | index.html:110 | Implementation/main/main.js, Implementation/main/plugin-manager-ui.js, Implementation/LinkCore/PluginWorkbenchTabUnit.js | Not verified |
| pluginManagerPages | div | index.html:113 | Implementation/main/plugin-manager-ui.js | Not verified |
| pluginLegacySettings | div | index.html:114 | Implementation/main/plugin-manager-ui.js | Not verified |
| pluginPerformanceOptions | section | index.html:116 | none found | Not verified |
| pluginMaxLabel | label | index.html:119 | none found | Not verified |
| pluginMaxMiB | input | index.html:122 | Implementation/main/main.js | Not verified |
| pluginApply | button | index.html:124 | Implementation/main/main.js | Not verified |
| pluginLimitNote | p | index.html:126 | Implementation/main/main.js | Not verified |
| goLineBar | div | index.html:136 | none found | Not verified |
| goLineLabel | label | index.html:137 | none found | Not verified |
| goLineInput | input | index.html:138 | Implementation/main/main.js | Not verified |
| goLineButton | button | index.html:140 | Implementation/main/main.js | Not verified |
| goLineHint | span | index.html:141 | Implementation/main/main.js | Not verified |
| meterFill | div | index.html:146 | none found | Not verified |
| meterPercent | span | index.html:148 | none found | Not verified |
| statusLamp | span | index.html:149 | none found | Not verified |
| status | span | index.html:150 | none found | Not verified |
| position | span | index.html:152 | none found | Not verified |
| fileType | span | index.html:154 | Implementation/main/main.js | Not verified |
| blockedTypesDialog | dialog | index.html:157 | Implementation/main/main.js | Not verified |
| blockedTypesTitle | h2 | index.html:162 | none found | Not verified |
| blockedTypesDescription | p | index.html:163 | none found | Not verified |
| blockedTypesClose | button | index.html:167 | none found | Not verified |
| blockedTypesForm | form | index.html:171 | Implementation/main/main.js | Not verified |
| blockedTypesInputLabel | label | index.html:172 | none found | Not verified |
| blockedTypesInput | input | index.html:175 | Implementation/main/main.js | Not verified |
| blockedTypesAdd | button | index.html:177 | none found | Not verified |
| blockedTypesListLabel | span | index.html:181 | none found | Not verified |
| blockedTypesCount | strong | index.html:182 | Implementation/main/main.js | Not verified |
| blockedTypesReset | button | index.html:183 | Implementation/main/main.js | Not verified |
| blockedTypesList | div | index.html:185 | Implementation/main/main.js | Not verified |
| blockedTypesError | p | index.html:187 | Implementation/main/main.js | Not verified |
| blockedTypesFooter | span | index.html:191 | none found | Not verified |
| blockedTypesDone | button | index.html:192 | none found | Not verified |
| paletteDialog | dialog | index.html:196 | none found | Not verified |
| paletteTitle | h2 | index.html:200 | none found | Not verified |
| paletteClose | button | index.html:202 | none found | Not verified |
| paletteLabel | label | index.html:222 | none found | Not verified |
| paletteHex | span | index.html:223 | none found | Not verified |
| palettePicker | input | index.html:226 | none found | Not verified |
| paletteHint | span | index.html:227 | none found | Not verified |
| palettePresetLabel | span | index.html:238 | none found | Not verified |
| paletteMode | span | index.html:239 | none found | Not verified |
| paletteDark | button | index.html:242 | none found | Not verified |
| paletteLight | button | index.html:243 | none found | Not verified |
| paletteFooterHint | span | index.html:247 | none found | Not verified |
| paletteDone | button | index.html:248 | none found | Not verified |

## JS modules with dynamically constructed UI

The list indicates DOM creation/insertion patterns only.
Each module still requires runtime inspection and stable ID mapping.

- `Implementation/main/default-ai-agent-launcher.js`
- `Implementation/main/legacy-powershell/powershell-ui.js`
- `Implementation/main/main.js`
- `Implementation/main/plugin-agent-download.js`
- `Implementation/main/plugin-manager-ui.js`
- `Implementation/main/plugin-resource-view.js`
- `Implementation/main/plugin-template-download.js`
- `Implementation/main/syntax-overlay-controller.js`
- `Implementation/object/PluginLocalAgentObject.js`
- `Implementation/LinkCore/PluginSandboxBridge.js`
- `Implementation/LinkCore/PluginUIHostUnit.js`

## Pending manual/browser verification

- Compare DOM after menu opens, plugins load, windows dock and tabs change.
- Inspect runtime-generated IDs, class-based controls and shadow roots.
- Link each UI ID to OCDA Object, UISP Property and HubUnit Request/Response.
- Determine geometry source, parent, theme, locale, focus, tab, z-index.
- Distinguish native controls from plugin-owned extension slots.
- Verify accessibility/keyboard behavior and responsive constraints.
- Reconcile every UI API with API List and OMU Event Chains.


