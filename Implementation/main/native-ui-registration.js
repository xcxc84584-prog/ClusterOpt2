/**
 * PR23.1/23.6 — native static HTML IDs from the audited source inventory.
 * Host-only registration, not a plugin-controlled DOM selector API.
 * Runtime-created plugin elements are intentionally excluded.
 */
export const NativeUIStaticIds = Object.freeze([
  "app",
  "versionLabel",
  "explorerToggle",
  "explorerPowerShell",
  "menuBtn",
  "menu",
  "newFile",
  "openFile",
  "saveFile",
  "saveAsFile",
  "closeFile",
  "closeAllMain",
  "toolBtn",
  "toolOptions",
  "languageBtn",
  "languageOptions",
  "pluginBtn",
  "paletteBtn",
  "blockedTypesBtn",
  "priorityHeading",
  "priority",
  "clusterWorkspaceShell",
  "explorerPanel",
  "explorerTitle",
  "explorerClose",
  "explorerAddFolder",
  "explorerAddFile",
  "explorerRefresh",
  "explorerSearch",
  "explorerTree",
  "clusterEditorColumn",
  "tabs",
  "workspace",
  "empty",
  "emptyHint",
  "editorPane",
  "gutter",
  "tabGuide",
  "editor",
  "pluginWindow",
  "pluginManagerPages",
  "pluginLegacySettings",
  "pluginPerformanceOptions",
  "pluginMaxLabel",
  "pluginMaxMiB",
  "pluginApply",
  "pluginLimitNote",
  "goLineBar",
  "goLineLabel",
  "goLineInput",
  "goLineButton",
  "goLineHint",
  "meterFill",
  "meterPercent",
  "statusLamp",
  "status",
  "position",
  "fileType",
  "blockedTypesDialog",
  "blockedTypesTitle",
  "blockedTypesDescription",
  "blockedTypesClose",
  "blockedTypesForm",
  "blockedTypesInputLabel",
  "blockedTypesInput",
  "blockedTypesAdd",
  "blockedTypesListLabel",
  "blockedTypesCount",
  "blockedTypesReset",
  "blockedTypesList",
  "blockedTypesError",
  "blockedTypesFooter",
  "blockedTypesDone",
  "paletteDialog",
  "paletteTitle",
  "paletteClose",
  "paletteLabel",
  "paletteHex",
  "palettePicker",
  "paletteHint",
  "palettePresetLabel",
  "paletteMode",
  "paletteDark",
  "paletteLight",
  "paletteFooterHint",
  "paletteDone"
]);

const cap = n => Number.isFinite(n) ?
  Math.max(-100000, Math.min(100000, n)) : 0;

function kindFor(element) {
  const tag = element.tagName.toLowerCase();
  if (tag === "button") return "button";
  if (tag === "dialog" || element.id === "pluginWindow") return "window";
  return "panel";
}

export function registerNativeUIFromDOM(core, doc) {
  const results = { registered: 0, missing: [], rejected: [] };
  for (const uiId of NativeUIStaticIds) {
    const element = doc.getElementById(uiId);
    if (!element) { results.missing.push(uiId); continue; }
    const rect = element.getBoundingClientRect();
    const registration = core.uiControl.registerHostSurface({
      uiId, kind: kindFor(element), parentId: "root",
      owner: "LinkCore", revision: 0,
      geometry: {
        space: "viewport", x: cap(rect.x), y: cap(rect.y),
        width: Math.max(0, cap(rect.width)),
        height: Math.max(0, cap(rect.height))
      },
      appearance: {}, interaction: {}, accessibility: {}
    });
    if (registration.ok) results.registered++;
    else results.rejected.push({ uiId, status: registration.status });
  }
  return results;
}
