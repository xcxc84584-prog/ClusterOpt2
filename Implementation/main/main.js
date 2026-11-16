import { mountLanguageUI } from "./language-ui.js";
import { Language } from "../property/Language.js";
import { mountPaletteUI } from "./palette-ui.js";
import { exposeVTE } from "../LinkCore/VirtualTestEnvironment.js";
import { linkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";
import { SessionRecovery } from "../object/SessionRecovery.js";
import { FileTypeManager } from "../object/FileTypeManager.js";
import { DocumentStatus, statusLabel } from "../property/DocumentStatus.js";

const uiIds = {
  tabs: "tabs", editor: "editor", editorSurface: "editorPane",
  emptyState: "empty", lineNumbers: "gutter", statusLamp: "statusLamp",
  statusText: "status", lineInfo: "position",
  progressFill: "meterFill", progressText: "meterPercent",
  tabGuide: "tabGuide"
};
const ui = Object.fromEntries(Object.entries(uiIds).map(([key, id]) =>
  [key, document.getElementById(id)]));

let guideFrame = 0;
let guideAnchor = null;
const workspace = new FileWorkspace(linkCore, render);
const explorer = new Explorer(linkCore);
const recovery = new SessionRecovery(linkCore);
const fileTypes = new FileTypeManager(linkCore);
let recoveryReady = false;
let recoveryTimer = 0;
let recoveryWrites = Promise.resolve();
function queueRecovery() {
  if (!recoveryReady) return;
  window.clearTimeout(recoveryTimer);
  recoveryTimer = window.setTimeout(() => {
    // The previous write must finish before taking a new snapshot.
    recoveryWrites = recoveryWrites.then(async () => {
      const result = await linkCore.request("ui",
        "session-recovery", "persist");
      if (!result.ok) {
        linkCore.omu.record("EHU", "ui", "Recovery.Persist",
          result.status, "session-recovery", { error: result.error });
      }
    }).catch(error => {
      linkCore.omu.record("EHU", "ui", "Recovery.Queue",
        500, "session-recovery", { error: String(error) });
    });
  }, 350);
}
let explorerRequestId = 0;
let explorerExpanded = false;
let explorerMenu = null;
let explorerSelectedId = null;
let explorerMenuLevel = "primary";
let explorerMenuId = null;
let explorerObservedActiveId = null;
function closeExplorerMenu() {
  explorerMenu?.remove();
  explorerMenu = null;
  explorerMenuId = null;
}
/**
 * Original ClusterOpt row-local context toolbar. One selected path
 * is tracked independently of editor status and folder expansion.
 */
function openExplorerMenu(node) {
  explorerSelectedId = node.id;
  explorerMenuId = node.id;
  explorerMenuLevel = "primary";
  void renderExplorer();
}
function appendExplorerActions(row, node) {
  if (explorerMenuId !== node.id) return;
  const toolbar = document.createElement("span");
  toolbar.className = "explorer-inline-actions";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", localized("explorerActions"));
  const primary = [
    ["open", "◇", "explorerOpenFile"],
    ["rename", "✎", "explorerRename"],
    ["more", "⋯", "explorerMore"],
    ["close", "×", "explorerCloseEntry"]
  ];
  const secondary = [
    ["back", "‹", "explorerBack"],
    ["folder", "▣", "explorerNewFolder"],
    ["cut", "✂", "explorerCut"],
    ["copy", "▤", "explorerCopy"],
    ["paste", "▧", "explorerPaste"],
    ["delete", "⌫", "explorerDelete"]
  ];
  const entries = explorerMenuLevel === "primary" ? primary : secondary;
  for (const [key, glyph, label] of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "explorer-inline-action";
    button.dataset.action = key;
    button.title = localized(label);
    button.setAttribute("aria-label", localized(label));
    const symbol = document.createElement("span");
    symbol.className = "explorer-action-symbol";
    symbol.textContent = glyph;
    button.append(symbol);
    // File CRUD, clipboard, and rename are separately scheduled to
    // avoid unsafe partial writes; never present a nonworking action.
    button.disabled = ["rename", "folder", "cut",
      "copy", "paste", "delete"].includes(key) ||
      (key === "close" && node.kind === "directory" &&
      (!node.id.startsWith("root-") || node.id.includes("/")));
    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      if (key === "more" || key === "back") {
        explorerMenuLevel = key === "more" ? "secondary" : "primary";
        await renderExplorer();
        return;
      }
      explorerMenuId = null;
      if (key === "close") {
        if (node.kind === "directory" &&
            node.id.startsWith("root-") &&
            !node.id.includes("/")) {
          const response = await linkCore.request("ui", "explorer",
            "closeRoot", { id: node.id }, { origin: "user" });
          if (!response.ok) notify(response.error);
          if (response.ok && response.value) {
            explorerSelectedId = null;
            queueRecovery();
          }
        } else if (node.documentId) {
          await perform("close", { id: node.documentId });
        }
      } else if (key === "open") {
        const action = node.kind === "directory" ? "expand" : "openEntry";
        const response = await linkCore.request("ui", "explorer",
          action, { id: node.id }, { origin: "user" });
        if (!response.ok) notify(response.error);
      }
      await renderExplorer();
    });
    toolbar.append(button);
  }
  row.classList.add("has-inline-actions");
  row.append(toolbar);
}

document.addEventListener("click", event => {
  if (!event.target.closest(".explorer-context")) closeExplorerMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeExplorerMenu();
});
const explorerPanel = document.getElementById("explorerPanel");
const explorerToggle = document.getElementById("explorerToggle");
function saveExplorerView() {
  try {
    window.sessionStorage.setItem("clusteropt2.explorer.view",
      JSON.stringify({
        visible: explorerExpanded,
        query: document.getElementById("explorerSearch").value,
        scrollTop: document.getElementById("explorerTree").scrollTop
      }));
  } catch {
    linkCore.omu.record("EHU", "ui", "Explorer.ViewPersist",
      503, "sessionStorage");
  }
}
function toggleExplorer(visible = explorerPanel.hidden) {
  explorerExpanded = visible;
  closeExplorerMenu();
  explorerPanel.hidden = !visible;
  explorerToggle.setAttribute("aria-expanded", String(visible));
  saveExplorerView();
  if (visible) void renderExplorer();
}
explorerToggle.addEventListener("click", () => toggleExplorer());
document.getElementById("explorerClose").addEventListener(
  "click", () => toggleExplorer(false));
exposeVTE(window);
document.getElementById("versionLabel").textContent = linkCore.getSnapshot().version;
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuBtn");
function closeMenu() {
  menu.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  const tools = document.getElementById("toolOptions");
  if (tools) tools.hidden = true;
  const languages = document.getElementById("languageOptions");
  if (languages) languages.hidden = true;
}
menuButton.addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  menuButton.setAttribute("aria-expanded", String(!menu.hidden));
});
document.addEventListener("click", event => {
  if (!event.target.closest(".menu-wrap")) closeMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeMenu();
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    closeMenu();
    void perform("save", { saveAs: event.shiftKey });
  } else if (key === "o") {
    event.preventDefault();
    closeMenu();
    void perform("open");
  } else if (key === "n") {
    event.preventDefault();
    closeMenu();
    void perform("new");
  }
});

linkCore.register({
  id: "ui",
  strictOCDA: true,
  ocda: Object.freeze({
    Request: ["new", "open", "save", "close", "closeAll", "reorder",
      "activate", "setPriority", "syncExternal"],
    Response: [], UserAPI: ["new", "open", "save", "close", "closeAll",
      "reorder", "setPriority", "syncExternal"],
    AgentAPI: [], Property: ["DocumentStatus", "SystemVersion",
      "Language", "EditorInteractionPolicy"],
    Program: "MainUI", EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
  }),
  receive: async () => {
    throw new Error("UI does not accept external actions");
  }
});

const editorPolicy =
  linkCore.readProperty("ui", "EditorInteractionPolicy").value;
let paletteStorage = null;
try {
  paletteStorage = window.localStorage;
} catch {
  linkCore.omu.record("EHU", "ui", "Storage.Access", 503,
    "UI_COLOR", { reason: "Color preference storage is unavailable" });
}
mountPaletteUI(linkCore, document, paletteStorage);
mountLanguageUI(linkCore, document, paletteStorage, () => {
  render();
  renderBlockedTypes();
});

function localized(key, args = {}) {
  const locale = linkCore.readProperty("ui", "Language").value;
  return Language.translate(locale, key, args);
}
const notify = message => { ui.statusText.textContent = message; };

function render() {
  const active = workspace.active;
  renderPriority();
  void renderExplorer();
  queueRecovery();
  ui.tabs.replaceChildren();
  for (const [index, doc] of workspace.documents.entries()) {
    const tab = document.createElement("button");
    tab.className = "tab" + (active?.id === doc.id ? " active" : "");
    tab.type = "button";
    tab.title = doc.name;
    tab.draggable = true;
    tab.addEventListener("dragstart", event => {
      if (event.target.closest(".close")) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    });
    tab.addEventListener("dragover", event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    tab.addEventListener("drop", event => {
      event.preventDefault();
      const from = Number(event.dataTransfer.getData("text/plain"));
      if (!Number.isInteger(from) || from < 0) return;
      void perform("reorder", { from, to: index });
    });
    const label = document.createElement("span");
    label.className = "name";
    label.textContent = doc.name;
    const dirty = document.createElement("span");
    dirty.className = "dirty";
    dirty.textContent = doc.status === DocumentStatus.SYNCED ? "" : "●";
    const close = document.createElement("span");
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label", localized("closeFile") + " " + doc.name);
    close.addEventListener("click", event => {
      event.stopPropagation();
      void perform("close", { id: doc.id });
    });
    tab.addEventListener("click", () => {
      void perform("activate", { id: doc.id });
    });
    tab.append(label, dirty, close);
    ui.tabs.append(tab);
  }
  ui.editorSurface.hidden = !active;
  ui.emptyState.hidden = !!active;
  if (!active) {
    ui.statusLamp.className = "lamp green";
    ui.statusText.textContent = localized("ready");
    ui.progressFill.style.width = "0%";
    ui.progressText.textContent = "";
    return;
  }
  // Never replace text the user is currently typing with a stale
  // queued Request/Response value while asynchronous saves are running.
  const switchedTab = ui.editor.dataset.documentId !== active.id;
  if (switchedTab || active.externalReloaded || (ui.editor.readOnly &&
      active.status !== DocumentStatus.LOADING) ||
      (ui.editor !== document.activeElement &&
      ui.editor.value !== active.text)) {
    ui.editor.value = active.text;
    if (active.externalReloaded) {
      ui.editor.selectionStart = ui.editor.selectionEnd =
        Math.min(active.cursor, active.text.length);
      active.externalReloaded = false;
    }
  }
  ui.editor.readOnly = active.status === DocumentStatus.LOADING;
  ui.editor.dataset.documentId = active.id;
  if (switchedTab) {
    guideAnchor = null;
    ui.editor.selectionStart = ui.editor.selectionEnd =
      Math.min(active.cursor, ui.editor.value.length);
  }
  if (switchedTab) ui.editor.scrollTop = active.scrollTop;
  renderLines();
  scheduleGuides();
  updateStatus();
}

/**
 * Render only the latest Explorer result; old async responses cannot
 * replace a newer search result after a fast query change.
 */
async function renderExplorer() {
  if (!explorerExpanded) return;
  const container = document.getElementById("explorerTree");
  const query = document.getElementById("explorerSearch").value;
  const requestId = ++explorerRequestId;
  const result = await linkCore.request("ui", "explorer", "list", {
    query
  }, { origin: "user" });
  if (requestId !== explorerRequestId) return;
  if (!result.ok) {
    linkCore.omu.record("EHU", "ui", "Explorer.Render",
      result.status, "explorer", { error: result.error });
    return;
  }
  const fragment = document.createDocumentFragment();
  const activeId = workspace.activeId;
  if (activeId !== explorerObservedActiveId) {
    explorerObservedActiveId = activeId;
    explorerSelectedId = null;
    explorerMenuId = null;
  }
  const activeNodes = [];
  const collectActive = nodes => {
    for (const node of nodes) {
      if (node.documentId === activeId) activeNodes.push(node.id);
      collectActive(node.children ?? []);
    }
  };
  collectActive(result.value);
  const selectedId = explorerSelectedId ??
    (activeNodes.length === 1 ? activeNodes[0] : null);
  const appendNode = (node, depth = 0) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "explorer-entry";
    button.setAttribute("role", "treeitem");
    button.setAttribute("aria-level", String(depth + 1));
    button.style.paddingLeft = (8 + depth * 14) + "px";
    if (selectedId === node.id) button.classList.add("active");
    const arrow = document.createElement("span");
    arrow.className = "explorer-arrow";
    arrow.textContent = node.kind === "directory" ?
      (node.expanded ? "▾" : "▸") : " ";
    const icon = document.createElement("span");
    icon.className = "explorer-file-icon";
    icon.textContent = node.kind === "directory" ? "▣" : "◇";
    const name = document.createElement("span");
    name.className = "explorer-name";
    name.textContent = node.name;
    button.title = node.name;
    button.dataset.entryId = node.id;
    button.draggable = true;
    button.append(arrow, icon, name);
    button.addEventListener("dragstart", event => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        "application/x-cluster-explorer-entry", node.id);
    });
    button.addEventListener("dragover", event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    button.addEventListener("drop", async event => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData(
        "application/x-cluster-explorer-entry");
      if (!sourceId) return;
      const result = await linkCore.request("ui", "explorer", "reorder", {
        sourceId, targetId: node.id
      }, { origin: "user" });
      if (!result.ok) notify(result.error);
      if (result.ok) {
        queueRecovery();
        await renderExplorer();
      }
    });
    button.addEventListener("contextmenu", event => {
      event.preventDefault();
      openExplorerMenu(node);
    });
    button.addEventListener("click", async event => {
      if (event.target.closest(".explorer-disclosure")) return;
      explorerSelectedId = node.id;
      explorerMenuId = null;
      if (node.kind === "file") {
        const response = await linkCore.request("ui", "explorer",
          "openEntry", { id: node.id }, { origin: "user" });
        if (!response.ok) notify(response.error);
      }
      await renderExplorer();
    });
    if (node.kind === "directory") {
      arrow.classList.add("explorer-disclosure");
      arrow.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        explorerMenuId = null;
        const response = await linkCore.request("ui", "explorer",
          "expand", { id: node.id }, { origin: "user" });
        if (!response.ok) notify(response.error);
        await renderExplorer();
      });
    }
    appendExplorerActions(button, node);
    fragment.append(button);
    if (node.expanded) {
      node.children.forEach(child => appendNode(child, depth + 1));
    }
  };
  result.value.forEach(node => appendNode(node));
  const priorScroll = container.scrollTop;
  container.replaceChildren(fragment);
  container.scrollTop = priorScroll;
}

function renderPriority() {
  const priority = linkCore.readProperty("ui", "StoragePriority").value;
  const control = document.getElementById("priority");
  if (control && control.value !== priority) control.value = priority;
}

function scheduleGuides() {
  if (guideFrame) return;
  guideFrame = window.requestAnimationFrame(() => {
    guideFrame = 0;
    if (!workspace.active) {
      ui.tabGuide.textContent = "";
      return;
    }
    const computed = window.getComputedStyle(ui.editor);
    const lineHeight = parseFloat(computed.lineHeight) || 22;
    const bounds = editorPolicy.guideWindow(
      ui.editor.value, ui.editor.scrollTop, lineHeight,
      ui.editor.clientHeight, guideAnchor);
    guideAnchor = { firstLine: bounds.firstLine, offset: bounds.offset };
    ui.tabGuide.textContent = bounds.lines.join("\\n");
    ui.tabGuide.style.top = (16 -
      (ui.editor.scrollTop % lineHeight)) + "px";
  });
}

function renderLines() {
  const text = ui.editor.value;
  const count = text.split("\n").length;
  ui.lineNumbers.textContent = Array.from(
    { length: count }, (_, i) => String(i + 1)
  ).join("\n");
  ui.lineNumbers.scrollTop = ui.editor.scrollTop;
  const position = ui.editor.selectionStart;
  const prior = text.slice(0, position);
  const line = prior.split("\n").length;
  const col = prior.length - prior.lastIndexOf("\n");
  ui.lineInfo.textContent = "Ln " + line + ", Col " + col;
}

function updateStatus() {
  const doc = workspace.active;
  if (!doc) return;
  ui.statusLamp.className = "lamp " + doc.status;
  ui.statusText.textContent = doc.error && doc.status === DocumentStatus.ERROR ?
    doc.error : statusLabel(doc.status,
      linkCore.readProperty("ui", "Language").value);
  ui.progressFill.style.width = doc.progress + "%";
  ui.progressText.textContent = doc.status === DocumentStatus.LOADING ?
    doc.progress + "%" : "";
}

ui.editor.addEventListener("input", async () => {
  guideAnchor = null;
  scheduleGuides();
  const doc = workspace.active;
  if (!doc) return;
  doc.cursor = ui.editor.selectionStart;
  doc.scrollTop = ui.editor.scrollTop;
  const result = await linkCore.request("ui", doc.id, "edit", {
    text: ui.editor.value
  }, { origin: "user" });
  if (!result.ok) notify(result.error);
  renderLines();
  updateStatus();
  queueRecovery();
  // Avoid regenerating all tabs on every keystroke in a large document.
  for (const tab of ui.tabs.children) {
    if (tab.classList.contains("active")) {
      tab.querySelector(".dirty").textContent = "●";
    }
  }
});
ui.editor.addEventListener("scroll", () => {
  const doc = workspace.active;
  if (doc) doc.scrollTop = ui.editor.scrollTop;
  ui.lineNumbers.scrollTop = ui.editor.scrollTop;
  scheduleGuides();
  queueRecovery();
});
ui.editor.addEventListener("click", () => {
  if (workspace.active) workspace.active.cursor = ui.editor.selectionStart;
  renderLines();
});
ui.editor.addEventListener("keyup", () => {
  if (workspace.active) workspace.active.cursor = ui.editor.selectionStart;
  renderLines();
});
ui.editor.addEventListener("keydown", event => {
  if (event.ctrlKey || event.altKey || event.metaKey ||
      event.isComposing || ui.editor.readOnly) return;
  const transform = editorPolicy.transform(
    ui.editor.value, ui.editor.selectionStart,
    ui.editor.selectionEnd, event.key, {
      shiftKey: event.shiftKey, composing: event.isComposing
    });
  if (!transform) return;
  event.preventDefault();
  ui.editor.setSelectionRange(transform.start, transform.end);
  // On Chromium, insertText joins native edit history (Ctrl+Z / Redo).
  // Keep the standards-based RangeText fallback for other engines.
  const nativeUndo = document.execCommand?.(
    "insertText", false, transform.insert) === true;
  if (!nativeUndo) {
    ui.editor.setRangeText(transform.insert, transform.start,
      transform.end, "preserve");
    ui.editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
  ui.editor.setSelectionRange(transform.caret,
    transform.selectionEnd ?? transform.caret);
});
async function perform(action, payload = {}) {
  closeMenu();
  try {
    // Browser pickers must run synchronously inside a user gesture,
    // BEFORE asynchronous HubUnit scheduling starts.
    if (action === "open") {
      if (!window.showOpenFilePicker) {
        throw new Error(localized("openUnavailable"));
      }
      payload.handles = await window.showOpenFilePicker({
        multiple: true
      });
    }
    if (action === "save") {
      const doc = workspace.active;
      if (!doc) return;
      if (payload.saveAs || !doc.handle) {
        if (!window.showSaveFilePicker) {
          throw new Error(localized("saveUnavailable"));
        }
        payload.handle = await window.showSaveFilePicker({
          suggestedName: doc.name
        });
      }
    }
    const result = await linkCore.request("ui", "workspace", action, payload,
      { origin: "user" });
    if (!result.ok) notify(result.error);
  } catch (error) {
    if (error.name !== "AbortError") {
      linkCore.omu.record("EHU", "ui", "Picker." + action,
        500, "workspace", { error: String(error) });
      notify(String(error));
    }
  }
}
document.getElementById("explorerSearch").addEventListener(
  "input", () => {
    saveExplorerView();
    void renderExplorer();
  });
document.getElementById("explorerTree").addEventListener(
  "scroll", () => saveExplorerView());
document.getElementById("explorerAddFile").addEventListener(
  "click", () => { void perform("open"); });
document.getElementById("explorerAddFolder").addEventListener(
  "click", () => { void importExplorerFolder(); });
document.getElementById("explorerRefresh").addEventListener(
  "click", async () => {
    const result = await linkCore.request("ui", "explorer",
      "refreshTree", {}, { origin: "user" });
    if (!result.ok) notify(result.error);
    await renderExplorer();
  });
async function importExplorerFolder() {
  try {
    if (!window.showDirectoryPicker) {
      throw new Error(localized("folderUnavailable"));
    }
    const handle = await window.showDirectoryPicker();
    const result = await linkCore.request("ui", "explorer",
      "importFolder", { handle }, { origin: "user" });
    if (!result.ok) notify(result.error);
    queueRecovery();
    await renderExplorer();
  } catch (error) {
    if (error.name !== "AbortError") {
      linkCore.omu.record("EHU", "ui", "Explorer.ImportFolder",
        500, "explorer", { error: String(error) });
      notify(String(error));
    }
  }
}
function renderBlockedTypes() {
  const values = linkCore.readProperty("ui", "BlockedFileTypes").value;
  const container = document.getElementById("blockedTypesList");
  container.replaceChildren();
  document.getElementById("blockedTypesCount").textContent =
    String(values.length);
  const labels = {
    blockedTypesTitle: "blockedTypes",
    blockedTypesDescription: "blockedTypesDescription",
    blockedTypesInputLabel: "blockedTypesInputLabel",
    blockedTypesAdd: "blockedTypesAdd",
    blockedTypesListLabel: "blockedTypesListLabel",
    blockedTypesReset: "blockedTypesReset",
    blockedTypesFooter: "blockedTypesFooter",
    blockedTypesDone: "blockedTypesDone"
  };
  for (const [id, key] of Object.entries(labels)) {
    document.getElementById(id).textContent = localized(key);
  }
  for (const extension of values) {
    const row = document.createElement("div");
    row.className = "file-tool-type-row";
    row.setAttribute("role", "listitem");
    const name = document.createElement("code");
    name.textContent = extension;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = localized("blockedTypesRemove");
    remove.addEventListener("click", () => {
      void changeBlockedTypes("remove", extension);
    });
    row.append(name, remove);
    container.append(row);
  }
}
async function changeBlockedTypes(action, extension = "") {
  const result = await linkCore.request("ui", "file-types",
    action, { extension }, { origin: "user" });
  document.getElementById("blockedTypesError").textContent =
    result.ok ? "" : result.error;
  if (result.ok) {
    renderBlockedTypes();
    await renderExplorer();
  }
}
const blockedDialog = document.getElementById("blockedTypesDialog");
document.getElementById("blockedTypesBtn").addEventListener("click", () => {
  closeMenu();
  renderBlockedTypes();
  blockedDialog.showModal();
});
for (const id of ["blockedTypesClose", "blockedTypesDone"]) {
  document.getElementById(id).addEventListener("click", () =>
    blockedDialog.close());
}
document.getElementById("blockedTypesForm").addEventListener(
  "submit", event => {
    event.preventDefault();
    const input = document.getElementById("blockedTypesInput");
    void changeBlockedTypes("add", input.value);
    input.value = "";
  });
document.getElementById("blockedTypesReset").addEventListener(
  "click", () => { void changeBlockedTypes("reset"); });
document.getElementById("newFile").onclick = () => perform("new");
document.getElementById("openFile").onclick = () => perform("open");
document.getElementById("saveFile").onclick = () => perform("save");
document.getElementById("saveAsFile").onclick = () =>
  perform("save", { saveAs: true });
document.getElementById("closeFile").onclick = () => perform("close");
document.getElementById("closeAllMain").onclick = () =>
  perform("closeAll");
document.getElementById("priority").addEventListener("change", event => {
  void perform("setPriority", { priority: event.target.value });
});
// Focus checks and a bounded poll observe external disk changes without
// blocking typing or continuously probing hidden browser tabs.
let syncing = false;
async function checkExternal() {
  if (syncing || document.hidden || !workspace.documents.length) return;
  syncing = true;
  try {
    await linkCore.request("ui", "workspace", "syncExternal", {},
      { origin: "user" });
  } finally {
    syncing = false;
  }
}
window.addEventListener("focus", () => { void checkExternal(); });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void checkExternal();
});
window.setInterval(() => { void checkExternal(); }, 3000);
// File System Access API does not expose portable directory watch events.
let explorerSyncing = false;
window.setInterval(async () => {
  if (!explorerExpanded || explorerSyncing || document.hidden) return;
  explorerSyncing = true;
  try {
    const result = await linkCore.request("ui", "explorer",
      "syncExternal");
    if (result.ok && result.value) await renderExplorer();
    if (!result.ok) notify(result.error);
  } finally {
    explorerSyncing = false;
  }
}, 2500);
window.addEventListener("pagehide", () => {
  window.clearTimeout(recoveryTimer);
  if (recoveryReady) {
    recoveryWrites = recoveryWrites.then(() =>
      linkCore.request("ui", "session-recovery", "persist"));
  }
});
window.addEventListener("beforeunload", event => {
  if (!workspace.documents.some(doc =>
    doc.status !== DocumentStatus.SYNCED)) return;
  event.preventDefault();
  event.returnValue = "";
});
render();
void linkCore.request("ui", "session-recovery", "restore").then(
  async result => {
    recoveryReady = true;
    if (!result.ok) {
      linkCore.omu.record("EHU", "ui", "Recovery.Restore",
        result.status, "session-recovery", { error: result.error });
    }
    try {
      const view = JSON.parse(window.sessionStorage.getItem(
        "clusteropt2.explorer.view") ?? "null");
      if (view && typeof view.query === "string") {
        document.getElementById("explorerSearch").value = view.query;
        toggleExplorer(Boolean(view.visible));
        await renderExplorer();
        document.getElementById("explorerTree").scrollTop =
          Math.max(0, Number(view.scrollTop) || 0);
      }
    } catch {
      linkCore.omu.record("EHU", "ui", "Explorer.ViewRestore",
        503, "sessionStorage");
    }
    queueRecovery();
  });
