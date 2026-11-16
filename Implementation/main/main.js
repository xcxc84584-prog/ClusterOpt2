import { linkCore } from "../LinkCore/LinkCore.js";
import { FileWorkspace } from "../object/FileWorkspace.js";
import { DocumentStatus, statusLabel } from "../property/DocumentStatus.js";

const ui = Object.fromEntries([
  "tabs", "editor", "editorSurface", "emptyState", "lineNumbers",
  "statusLamp", "statusText", "lineInfo", "progressFill", "progressText"
].map(id => [id, document.getElementById(id)]));

const workspace = new FileWorkspace(linkCore, render);
linkCore.register({ id: "ui", receive: async () => {
  throw new Error("UI does not accept external actions");
} });
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
    label.className = "tab-label";
    label.textContent = doc.name;
    const dirty = document.createElement("span");
    dirty.className = "dirty";
    dirty.textContent = doc.status === DocumentStatus.SYNCED ? "" : "●";
    const close = document.createElement("span");
    close.className = "tab-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "關閉 " + doc.name);
    close.addEventListener("click", event => {
      event.stopPropagation();
      workspace.close(doc.id);
    });
    tab.addEventListener("click", () => workspace.activate(doc.id));
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
  if (ui.editor.dataset.documentId !== active.id ||
      ui.editor.value !== active.text) {
    ui.editor.value = active.text;
  }
  ui.editor.dataset.documentId = active.id;
  ui.editor.selectionStart = ui.editor.selectionEnd =
    Math.min(active.cursor, ui.editor.value.length);
  ui.editor.scrollTop = active.scrollTop;
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
  const result = await linkCore.request("workspace", doc.id, "edit", {
    text: ui.editor.value
  });
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
  const result = await linkCore.request("ui", "workspace", action, payload);
  if (!result.ok) notify(result.error);
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
