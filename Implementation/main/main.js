import { mountPaletteUI } from "./palette-ui.js";
import { exposeVTE } from "../LinkCore/VirtualTestEnvironment.js";
import { linkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { DocumentStatus, statusLabel } from "../property/DocumentStatus.js";

const uiIds = {
  tabs: "tabs", editor: "editor", editorSurface: "editorPane",
  emptyState: "empty", lineNumbers: "gutter", statusLamp: "statusLamp",
  statusText: "status", lineInfo: "position",
  progressFill: "meterFill", progressText: "meterPercent"
};
const ui = Object.fromEntries(Object.entries(uiIds).map(([key, id]) =>
  [key, document.getElementById(id)]));

const workspace = new FileWorkspace(linkCore, render);
exposeVTE(window);
document.getElementById("versionLabel").textContent = linkCore.getSnapshot().version;
const menu = document.getElementById("menu");
const menuButton = document.getElementById("menuBtn");
function closeMenu() {
  menu.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  const tools = document.getElementById("toolOptions");
  if (tools) tools.hidden = true;
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
    Request: ["new", "open", "save", "close", "activate"],
    Response: [], UserAPI: ["new", "open", "save", "close"],
    AgentAPI: [], Property: ["DocumentStatus", "SystemVersion"],
    Program: "MainUI", EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
  }),
  receive: async () => {
    throw new Error("UI does not accept external actions");
  }
});

mountPaletteUI(linkCore, document, window.localStorage);
const notify = message => { ui.statusText.textContent = message; };

function render() {
  const active = workspace.active;
  ui.tabs.replaceChildren();
  for (const doc of workspace.documents) {
    const tab = document.createElement("button");
    tab.className = "tab" + (active?.id === doc.id ? " active" : "");
    tab.type = "button";
    tab.title = doc.name;
    const label = document.createElement("span");
    label.className = "name";
    label.textContent = doc.name;
    const dirty = document.createElement("span");
    dirty.className = "dirty";
    dirty.textContent = doc.status === DocumentStatus.SYNCED ? "" : "●";
    const close = document.createElement("span");
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label", "關閉 " + doc.name);
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
    ui.statusText.textContent = "就緒";
    ui.progressFill.style.width = "0%";
    ui.progressText.textContent = "";
    return;
  }
  // Never replace text the user is currently typing with a stale
  // queued Request/Response value while asynchronous saves are running.
  const switchedTab = ui.editor.dataset.documentId !== active.id;
  if (switchedTab || (ui.editor.readOnly &&
      active.status !== DocumentStatus.LOADING) ||
      (ui.editor !== document.activeElement &&
      ui.editor.value !== active.text)) {
    ui.editor.value = active.text;
  }
  ui.editor.readOnly = active.status === DocumentStatus.LOADING;
  ui.editor.dataset.documentId = active.id;
  if (switchedTab) {
    ui.editor.selectionStart = ui.editor.selectionEnd =
      Math.min(active.cursor, ui.editor.value.length);
  }
  if (switchedTab) ui.editor.scrollTop = active.scrollTop;
  renderLines();
  updateStatus();
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
    doc.error : statusLabel(doc.status);
  ui.progressFill.style.width = doc.progress + "%";
  ui.progressText.textContent = doc.status === DocumentStatus.LOADING ?
    doc.progress + "%" : "";
}

ui.editor.addEventListener("input", async () => {
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
  if (event.key === "Tab") {
    event.preventDefault();
    const start = ui.editor.selectionStart;
    const end = ui.editor.selectionEnd;
    ui.editor.setRangeText("\t", start, end, "end");
    ui.editor.dispatchEvent(new Event("input"));
  }
});
async function perform(action, payload = {}) {
  closeMenu();
  try {
    // Browser pickers must run synchronously inside a user gesture,
    // BEFORE asynchronous HubUnit scheduling starts.
    if (action === "open") {
      if (!window.showOpenFilePicker) {
        throw new Error("需要 Chromium HTTPS 或 localhost 才能開啟文件");
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
          throw new Error("需要 Chromium HTTPS 或 localhost 才能儲存文件");
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
document.getElementById("newFile").onclick = () => perform("new");
document.getElementById("openFile").onclick = () => perform("open");
document.getElementById("saveFile").onclick = () => perform("save");
document.getElementById("saveAsFile").onclick = () =>
  perform("save", { saveAs: true });
document.getElementById("closeFile").onclick = () => perform("close");
window.addEventListener("beforeunload", event => {
  if (!workspace.documents.some(doc =>
    doc.status !== DocumentStatus.SYNCED)) return;
  event.preventDefault();
  event.returnValue = "";
});
render();
