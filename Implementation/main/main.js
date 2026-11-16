import { mountLanguageUI } from "./language-ui.js";
import { Language } from "../property/Language.js";
import { mountPaletteUI } from "./palette-ui.js";
import { exposeVTE } from "../LinkCore/VirtualTestEnvironment.js";
import { linkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { Explorer } from "../object/Explorer.js";
import { SessionRecovery } from "../object/SessionRecovery.js";
import { SliceRegistry } from "../object/SliceRegistry.js";
import { SliceLoader } from "../object/SliceLoader.js";
import { ViewportSliceController } from "../object/ViewportSliceController.js";
import { VirtualLineIndex } from "../object/VirtualLineIndex.js";
import { EditorViewportObserver } from "../object/EditorViewportObserver.js";
import { SliceRecoveryJournal } from "../object/SliceRecoveryJournal.js";
import { SliceEditTransaction } from "../object/SliceEditTransaction.js";
import { SliceWritebackUnit } from "../object/SliceWritebackUnit.js";
import { ToolTabManager } from "../object/ToolTabManager.js";
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
new ToolTabManager(linkCore);
const pluginWindow = document.getElementById("pluginWindow");
let toolState = { open: false, active: false, position: 0 };
let pluginCategory = "performance";
let observedWorkspaceActiveId = null;

function saveToolView() {
  try {
    window.sessionStorage.setItem("clusteropt2.tool-view.v1",
      JSON.stringify({ state: toolState, category: pluginCategory }));
  } catch (error) {
    linkCore.omu.record("EHU", "ui", "ToolView.Persist",
      503, "sessionStorage", { error: String(error) });
  }
}


async function requestTool(action, payload = {}) {
  const result = await linkCore.request("ui", "tool-tab-manager",
    action, payload, { origin: "user" });
  if (!result.ok) return notify(result.error);
  toolState = result.value;
  saveToolView();
  render();
  return result.value;
}

const explorer = new Explorer(linkCore);
const recovery = new SessionRecovery(linkCore);
const sliceRegistry = new SliceRegistry(linkCore);
new SliceLoader(linkCore);
new VirtualLineIndex(linkCore);
new ViewportSliceController(linkCore);
new EditorViewportObserver(linkCore);
// Patch16: registered for Hub/VTE, not connected to the live editor.
new SliceRecoveryJournal(linkCore);
new SliceEditTransaction(linkCore);
// Trusted sandbox only; the production FileDocument save stays unchanged.
new SliceWritebackUnit(linkCore);
const fileTypes = new FileTypeManager(linkCore);
// Read-only viewport observation: never mutates editor text or disk.
let viewportTimer = 0;
let viewportGeneration = 0;
let viewportObservedId = null;
let viewportObservedRevision = null;
let viewportQueue = Promise.resolve();
let renderedLineCount = 1;

function scheduleViewportObservation() {
  window.clearTimeout(viewportTimer);
  const generation = ++viewportGeneration;
  viewportTimer = window.setTimeout(() => {
    // Queue operations: an old tab must detach before a new one attaches.
    viewportQueue = viewportQueue.then(async () => {
      if (generation !== viewportGeneration) return;
      const active = workspace.active;
      const eligible = active && active.handle &&
        active.status === DocumentStatus.SYNCED &&
        !toolState.active && !active.externalChanged &&
        !active.virtualReadOnly;
      const request = (action, payload = {}) => linkCore.request(
        "ui", "editor-viewport-observer", action, payload,
        { origin: "user" });
      if (!eligible) {
        if (viewportObservedId) await request("detach");
        viewportObservedId = null;
        viewportObservedRevision = null;
        return;
      }
      const needsAttach = viewportObservedId !== active.id ||
        viewportObservedRevision !== active.revision;
      if (needsAttach) {
        if (viewportObservedId) {
          await request("detach");
          viewportObservedId = null;
        }
        const file = await active.handle.getFile();
        if (generation !== viewportGeneration ||
            active !== workspace.active ||
            active.status !== DocumentStatus.SYNCED) return;
        const attached = await request("attach", {
          id: active.id, blob: file
        });
        if (!attached.ok) return;
        viewportObservedId = active.id;
        viewportObservedRevision = active.revision;
      }
      if (generation !== viewportGeneration) return;
      const lineHeight = parseFloat(
        window.getComputedStyle(ui.editor).lineHeight) || 22;
      await request("navigate", {
        id: active.id, dirty: false,
        scrollTop: ui.editor.scrollTop,
        clientHeight: ui.editor.clientHeight,
        lineHeight, maxLine: renderedLineCount
      });
    }).catch(error => {
      // Observability must never block the real editor's data path.
      linkCore.omu.record("EHU", "ui", "ViewportObserver",
        503, "editor-viewport-observer", { error: String(error) });
    });
  }, 80);
}

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
      "Language", "EditorInteractionPolicy",
      "EditorViewportPolicy"],
    Program: "MainUI", EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
  }),
  receive: async () => {
    throw new Error("UI does not accept external actions");
  }
});

const editorPolicy =
  linkCore.readProperty("ui", "EditorInteractionPolicy").value;
const viewportPolicy =
  linkCore.readProperty("ui", "EditorViewportPolicy").value;
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
  if (workspace.activeId !== observedWorkspaceActiveId) {
    observedWorkspaceActiveId = workspace.activeId;
    if (toolState.active) {
      void requestTool("deactivate");
    }
  }
  const toolActive = toolState.open && toolState.active;
  const tabPolicy = linkCore.readProperty("ui", "ToolTabPolicy").value;
  const entries = tabPolicy.entries(workspace.documents, toolState);
  const documentById = new Map(workspace.documents.map(doc => [doc.id, doc]));
  ui.tabs.replaceChildren();
  for (const [index, entry] of entries.entries()) {
    const isTool = entry.kind === "tool";
    const doc = isTool ? null : documentById.get(entry.id);
    const selected = isTool ? toolActive :
      !toolActive && active?.id === entry.id;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab" + (selected ? " active" : "");
    tab.dataset.tabId = entry.id;
    tab.dataset.tabKind = entry.kind;
    tab.title = isTool ? localized("pluginManager") : doc.name;
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
      void reorderWorkbenchTabs(from, index);
    });
    const label = document.createElement("span");
    label.className = "name";
    label.textContent = isTool ? localized("pluginManager") : doc.name;
    const dirty = document.createElement("span");
    dirty.className = "dirty";
    dirty.textContent = !isTool && doc.status !== DocumentStatus.SYNCED ?
      "●" : "";
    const close = document.createElement("span");
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label", localized("closeFile") + " " +
      label.textContent);
    close.addEventListener("click", event => {
      event.stopPropagation();
      if (isTool) void requestTool("close");
      else void perform("close", { id: doc.id });
    });
    tab.addEventListener("click", () => {
      if (isTool) void requestTool("activate");
      else void focusDocumentTab(doc.id);
    });
    tab.append(label, dirty, close);
    ui.tabs.append(tab);
  }
  pluginWindow.hidden = !toolActive;
  if (!toolActive) {
    // LanguageManager invokes render() before Plugin controls bind.
    // Access the actual DOM here to avoid a TDZ on initial startup.
    const menu = document.getElementById("pluginCategoryMenu");
    const trigger = document.getElementById("pluginCategoryBtn");
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
  document.getElementById("fileType").textContent = toolActive ?
    localized("plugin") : localized("plainText");
  ui.editorSurface.hidden = !active || toolActive;
  ui.emptyState.hidden = !!active || toolActive;
  if (toolActive || !active) {
    ui.statusLamp.className = "lamp green";
    ui.statusText.textContent = localized("ready");
    ui.progressFill.dataset.status = DocumentStatus.SYNCED;
    ui.progressFill.style.width = "0%";
    ui.progressText.textContent = "";
    ui.lineInfo.textContent = toolActive ? localized("pluginManager") :
      "Ln 1, Col 1";
    scheduleViewportObservation();
    return;
  }
  // Never replace text the user is currently typing with a stale
  // queued Request/Response value while asynchronous saves are running.
  const switchedTab = ui.editor.dataset.documentId !== active.id;
  const switchedPage = active.virtualReadOnly &&
    ui.editor.dataset.virtualPageIndex !==
    String(active.virtualPageIndex);
  if (switchedTab || switchedPage || active.externalReloaded ||
      (ui.editor.readOnly &&
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
  ui.editor.readOnly = active.virtualReadOnly ||
    active.status === DocumentStatus.LOADING;
  ui.editor.dataset.virtualPageIndex = active.virtualReadOnly ?
    String(active.virtualPageIndex) : "";
  ui.editor.dataset.documentId = active.id;
  if (switchedTab || switchedPage) {
    guideAnchor = null;
    ui.editor.selectionStart = ui.editor.selectionEnd =
      Math.min(active.cursor, ui.editor.value.length);
  }
  if (switchedTab || switchedPage) {
    ui.editor.scrollTop = active.scrollTop;
  }
  renderLines();
  scheduleGuides();
  updateStatus();
  scheduleViewportObservation();
}

/**
 * Tool and file tabs use the same DOM strip but retain isolated
 * file ownership. HubUnit observes all tool lifecycle actions.
 */
async function focusDocumentTab(id) {
  if (toolState.active) await requestTool("deactivate");
  await perform("activate", { id });
}

async function reorderWorkbenchTabs(from, to) {
  const policy = linkCore.readProperty("ui", "ToolTabPolicy").value;
  const entries = policy.entries(workspace.documents, toolState);
  if (from < 0 || to < 0 ||
      from >= entries.length || to >= entries.length) return;
  if (entries[from].kind === "tool") {
    await requestTool("move", {
      index: to, documentCount: workspace.documents.length
    });
    return;
  }
  const docFrom = workspace.documents.findIndex(doc =>
    doc.id === entries[from].id);
  const docTo = workspace.documents.findIndex(doc =>
    doc.id === entries[to].id);
  if (docTo < 0) {
    // Dropping a file on the tool tab moves the tool instead.
    await requestTool("move", {
      index: docFrom, documentCount: workspace.documents.length
    });
    return;
  }
  await perform("reorder", { from: docFrom, to: docTo });
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

    // ClusterOpt DFOM: mirror literal whitespace with a dashed marker
    // only at Tab positions, preserving the stored document bytes.
    const mirror = document.createElement("span");
    mirror.className = "tab-guide-content";
    bounds.rawIndents.forEach((indent, index) => {
      const parts = indent.split("\t");
      for (let part = 0; part < parts.length; part++) {
        mirror.append(document.createTextNode(parts[part]));
        if (part < parts.length - 1) {
          const tab = document.createElement("span");
          tab.className = "dfom-tab";
          tab.textContent = "\t";
          mirror.append(tab);
        }
      }
      if (index < bounds.rawIndents.length - 1) {
        mirror.append(document.createTextNode("\n"));
      }
    });
    ui.tabGuide.replaceChildren(mirror);
    const position = viewportPolicy.guidePosition({
      scrollTop: ui.editor.scrollTop,
      scrollLeft: ui.editor.scrollLeft,
      lineHeight,
      paddingTop: parseFloat(computed.paddingTop),
      paddingLeft: parseFloat(computed.paddingLeft)
    });
    ui.tabGuide.style.top = position.top + "px";
    mirror.style.transform =
      "translateX(" + position.paddingLeft + "px)";
    ui.tabGuide.style.font = computed.font;
    ui.tabGuide.style.lineHeight = computed.lineHeight;
    ui.tabGuide.style.tabSize = computed.tabSize;
  });
}

function renderLines() {
  const text = ui.editor.value;
  const count = text.split("\n").length;
  renderedLineCount = count;
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
  const progress = viewportPolicy.progress(doc.status, doc.progress);
  ui.progressFill.dataset.status = progress.status;
  ui.progressFill.style.width = progress.percent + "%";
  ui.progressText.textContent = progress.label ?
    progress.percent + "%" : "";
}

let virtualPageBusy = false;

/** Page-bounded navigation preserves the old editor DOM and theme. */
async function turnVirtualPage(direction) {
  const doc = workspace.active;
  if (!doc?.virtualReadOnly || virtualPageBusy) return;
  const next = doc.virtualPageIndex + direction;
  if (next < 0 || next >= doc.virtualPageCount) return;
  virtualPageBusy = true;
  try {
    const result = await linkCore.request("ui", "workspace", "page", {
      id: doc.id, index: next
    }, { origin: "user" });
    if (!result.ok) notify(result.error);
  } finally {
    virtualPageBusy = false;
  }
}

ui.editor.addEventListener("wheel", event => {
  const doc = workspace.active;
  if (!doc?.virtualReadOnly || virtualPageBusy) return;
  const down = event.deltaY > 0;
  const editor = ui.editor;
  const bottom = editor.scrollTop + editor.clientHeight >=
    editor.scrollHeight - 2;
  const top = editor.scrollTop <= 1;
  if ((down && bottom) || (!down && top)) {
    const next = doc.virtualPageIndex + (down ? 1 : -1);
    if (next < 0 || next >= doc.virtualPageCount) return;
    event.preventDefault();
    void turnVirtualPage(down ? 1 : -1);
  }
}, { passive: false });

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
  scheduleViewportObservation();
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
  scheduleViewportObservation();
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
  if (workspace.active?.virtualReadOnly && event.altKey &&
      ["PageDown", "PageUp"].includes(event.key)) {
    event.preventDefault();
    void turnVirtualPage(event.key === "PageDown" ? 1 : -1);
    return;
  }
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
  if (action === "close" && !payload.id && toolState.active) {
    await requestTool("close");
    return;
  }
  if (action === "save" && toolState.active) return;
  if (["new", "open", "activate"].includes(action) &&
      toolState.active) await requestTool("deactivate");
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
    if (result.ok && action === "closeAll" && result.value) {
      await requestTool("close");
    }
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
    const controls = document.createElement("div");
    controls.className = "file-tool-type-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "✎";
    edit.title = localized("blockedTypesEdit") + " " + extension;
    edit.setAttribute("aria-label", edit.title);
    edit.addEventListener("click", () => {
      const next = window.prompt(localized("blockedTypesEditPrompt"),
        extension);
      if (next === null) return;
      void changeBlockedTypes("replace", extension, next);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = localized("blockedTypesRemove") + " " + extension;
    remove.setAttribute("aria-label", remove.title);
    remove.addEventListener("click", () => {
      void changeBlockedTypes("remove", extension);
    });
    controls.append(edit, remove);
    row.append(name, controls);
    container.append(row);
  }
}
async function changeBlockedTypes(action, extension = "", replacement = "") {
  const result = await linkCore.request("ui", "file-types",
    action, { extension, replacement }, { origin: "user" });
  document.getElementById("blockedTypesError").textContent =
    result.ok ? "" : result.status === 409 ?
      localized("blockedTypesDuplicate") :
      result.status === 400 ? localized("blockedTypesInvalid") :
      result.error;
  if (result.ok) {
    renderBlockedTypes();
    await renderExplorer();
  }
}
const blockedDialog = document.getElementById("blockedTypesDialog");
document.getElementById("blockedTypesBtn").addEventListener("click", () => {
  closeMenu();
  renderBlockedTypes();
  document.getElementById("blockedTypesError").textContent = "";
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
/**
 * PR8 configuration only: modifies the SliceRegistry memory admission
 * policy. This does not claim the main editor is slice-based yet.
 */
async function renderPluginBudget() {
  const result = await linkCore.request("ui", "slice-registry",
    "list", {}, { origin: "user" });
  if (!result.ok) return notify(result.error);
  const unlimited = result.value.limitBytes === null;
  document.getElementById("pluginUnlimited").checked = unlimited;
  document.getElementById("pluginMaxMiB").disabled = unlimited;
  if (!unlimited) {
    document.getElementById("pluginMaxMiB").value =
      String(result.value.limitBytes / (1024 * 1024));
  }
}
const pluginBtn = document.getElementById("pluginBtn");
const categoryTrigger = document.getElementById("pluginCategoryBtn");
const categoryMenu = document.getElementById("pluginCategoryMenu");
const categoryLabel = document.getElementById("pluginCategoryLabel");
const pluginTabs = [...categoryMenu.querySelectorAll("[data-plugin-tab]")];
const pluginPanels = [...pluginWindow.querySelectorAll("[data-plugin-panel]")];

function closePluginCategoryMenu(focusTrigger = false) {
  categoryMenu.hidden = true;
  categoryTrigger.setAttribute("aria-expanded", "false");
  if (focusTrigger) categoryTrigger.focus();
}

function openPluginCategoryMenu(focusLast = false) {
  categoryMenu.hidden = false;
  categoryTrigger.setAttribute("aria-expanded", "true");
  pluginTabs[focusLast ? pluginTabs.length - 1 : 0].focus();
}

function selectPluginTab(tab) {
  const chosen = pluginTabs.find(button =>
    button.dataset.pluginTab === tab);
  if (!chosen) return;
  pluginCategory = tab;
  saveToolView();
  for (const button of pluginTabs) {
    const selected = button === chosen;
    button.setAttribute("aria-checked", String(selected));
  }
  categoryLabel.textContent = chosen.textContent.trim();
  for (const panel of pluginPanels) {
    panel.hidden = panel.dataset.pluginPanel !== tab;
  }
  closePluginCategoryMenu();
}

categoryTrigger.addEventListener("click", () => {
  if (categoryMenu.hidden) openPluginCategoryMenu();
  else closePluginCategoryMenu();
});
categoryTrigger.addEventListener("keydown", event => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openPluginCategoryMenu(event.key === "ArrowUp");
  }
});
for (const button of pluginTabs) {
  button.addEventListener("click", () => {
    selectPluginTab(button.dataset.pluginTab);
    categoryTrigger.focus();
  });
}
categoryMenu.addEventListener("keydown", event => {
  const index = pluginTabs.indexOf(document.activeElement);
  let next = -1;
  if (event.key === "ArrowDown") next = (index + 1) % pluginTabs.length;
  if (event.key === "ArrowUp") {
    next = (index + pluginTabs.length - 1) % pluginTabs.length;
  }
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = pluginTabs.length - 1;
  if (next >= 0) {
    event.preventDefault();
    pluginTabs[next].focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    closePluginCategoryMenu(true);
  }
});
document.addEventListener("pointerdown", event => {
  if (!event.target.closest(".plugin-category-control")) {
    closePluginCategoryMenu();
  }
});
pluginBtn.addEventListener("click", () => {
  closeMenu();
  void requestTool("open", {
    index: workspace.documents.length,
    documentCount: workspace.documents.length
  }).then(() => {
    void renderPluginBudget();
  });
});
document.getElementById("pluginDone").addEventListener("click", () => {
  closePluginCategoryMenu();
  void requestTool("close");
});
document.getElementById("pluginUnlimited").addEventListener(
  "change", event => {
    document.getElementById("pluginMaxMiB").disabled =
      event.target.checked;
  });
document.getElementById("pluginApply").addEventListener("click", async () => {
  const unlimited = document.getElementById("pluginUnlimited").checked;
  const mib = Number(document.getElementById("pluginMaxMiB").value);
  const bytes = unlimited ? null : mib * 1024 * 1024;
  const result = await linkCore.request("ui", "slice-registry",
    "setLimit", { bytes }, { origin: "user" });
  const note = document.getElementById("pluginLimitNote");
  note.textContent = result.ok ?
    localized("pluginLimitNote") :
    localized("pluginLimitError") + ": " + result.error;
  if (result.ok) await renderPluginBudget();
});
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
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(
        "clusteropt2.tool-view.v1") ?? "null");
      if (stored?.state?.open) {
        await requestTool("restore", {
          state: stored.state, documentCount: workspace.documents.length
        });
        selectPluginTab(stored.category ?? "performance");
        if (toolState.active) void renderPluginBudget();
      }
    } catch (error) {
      linkCore.omu.record("EHU", "ui", "ToolView.Restore",
        503, "sessionStorage", { error: String(error) });
    }
    queueRecovery();
  });
