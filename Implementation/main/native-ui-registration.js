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
    const geometry = () => {
      const current = (doc.getElementById(uiId) ?? element)
        .getBoundingClientRect();
      return {
        space: "viewport", x: cap(current.x), y: cap(current.y),
        width: Math.max(0, cap(current.width)),
        height: Math.max(0, cap(current.height))
      };
    };
    const registration = core.uiControl.registerHostSurface({
      uiId, kind: kindFor(element), parentId: "root",
      owner: "LinkCore", revision: 0,
      geometry: {
        space: "viewport", x: cap(rect.x), y: cap(rect.y),
        width: Math.max(0, cap(rect.width)),
        height: Math.max(0, cap(rect.height))
      },
      appearance: {}, interaction: {}, accessibility: {}
    }, geometry);
    if (registration.ok) results.registered++;
    else results.rejected.push({ uiId, status: registration.status });
  }
  return results;
}

/**
 * Audited host-created literal ID assignments from PR23.1.
 * Dynamic IDs here are stable host controls, not inferred plugin nodes.
 * Entries not currently present are left unregistered until they appear.
 */
export const NativeUIDynamicIds = Object.freeze([
  "pluginBundledAgentLauncher",
  "powershellManagerPane",
  "pluginManagerSearch",
  "pluginSidebarToggle",
  "pluginConsentTitle",
  "pluginApiSearch",
  "pluginResourceSearch",
  "pluginAgentDownload",
  "pluginAgentMount",
  "pluginAgentQuickSetupDownload",
  "pluginMCPQuickSetupDownload",
  "pluginTemplateDownload",
  "saveCloseTitle",
  "pr11SyntaxOverlay"
]);

/**
 * Reconcile only the audited dynamic HOST identities. Updates caused by
 * plugin-owned content must never acquire a host UI identity.
 * The returned disposer releases observers on host teardown.
 */
export function observeNativeUIFromDOM(core, doc) {
  const registered = new Set();
  let scheduled = false;
  const synchronize = () => {
    scheduled = false;
    for (const uiId of NativeUIDynamicIds) {
      const element = doc.getElementById(uiId);
      const hostOwned = element &&
        !element.closest("[data-cluster-plugin-ui]");
      if (!hostOwned) {
        if (registered.delete(uiId)) {
          core.unregister("UICO." + uiId);
          core.uiControl.surfaces.delete(uiId);
        }
        continue;
      }
      if (registered.has(uiId) ||
          core.uiControl.surfaces.has(uiId)) continue;
      const geometry = () => {
        const current = doc.getElementById(uiId);
        if (!current || current.closest("[data-cluster-plugin-ui]")) {
          return { space: "viewport", x: 0, y: 0,
            width: 0, height: 0 };
        }
        const rect = current.getBoundingClientRect();
        return {
          space: "viewport", x: cap(rect.x), y: cap(rect.y),
          width: Math.max(0, cap(rect.width)),
          height: Math.max(0, cap(rect.height))
        };
      };
      const result = core.uiControl.registerHostSurface({
        uiId, kind: kindFor(element), parentId: "root",
        owner: "LinkCore", revision: 0,
        geometry: geometry(),
        appearance: {}, interaction: {}, accessibility: {}
      }, geometry);
      if (result.ok) registered.add(uiId);
      else {
        core.omu.record("EHU", "ui", "UICO.DynamicInventory",
          result.status, uiId);
      }
    }
  };
  const observer = new doc.defaultView.MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    doc.defaultView.queueMicrotask(synchronize);
  });
  observer.observe(doc.documentElement, {
    subtree: true, childList: true,
    attributes: true, attributeFilter: ["id"]
  });
  synchronize();
  return () => {
    observer.disconnect();
    for (const uiId of registered) {
      core.unregister("UICO." + uiId);
      core.uiControl.surfaces.delete(uiId);
    }
    registered.clear();
  };
}
