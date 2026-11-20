const ACTIVE_TABS = new WeakMap();

/**
 * Plugin-owned workbench tab adapter.
 * Main editor and PowerShell remain unmodified and retain tab ownership.
 * The observer only restores our disposable tab after their rerenders.
 */
export class PluginWorkbenchTabUnit {
  constructor(doc, view, onOpen, onClose) {
    this.doc = doc;
    this.view = view;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.tabs = doc.getElementById("tabs");
    this.workspace = doc.getElementById("workspace");
    this.column = doc.getElementById("clusterEditorColumn");
    this.active = false;
    this.tab = null;
    this.observer = null;
    this.onClick = event => {
      if (!event.target.closest?.(
        "#tabs .tab:not(.plugin-agent-tab), " +
        "#explorerPowerShell, #pluginBtn")) return;
      if (event.target.closest?.('#tabs .tab[data-tab-kind="tool"]')) {
        this.suspendPowerShell();
      }
      this.deactivate();
    };
  }

  ensureTab() {
    if (this.tab) return this.tab;
    const tab = this.doc.createElement("button");
    tab.type = "button";
    tab.className = "tab plugin-agent-tab";
    tab.dataset.tabId = "plugin:" +
      this.view.provider.providerId;
    tab.dataset.tabKind = "plugin";
    tab.title = this.view.frame.title;
    const name = this.doc.createElement("span");
    name.className = "name";
    name.textContent = "✧ " + this.view.frame.title;
    const close = this.doc.createElement("span");
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label",
      "Close " + this.view.frame.title + " tab");
    close.addEventListener("click", event => {
      event.stopPropagation();
      this.close();
    });
    tab.append(name, close);
    tab.addEventListener("click", () => this.open());
    this.tab = tab;
    return tab;
  }

  attach() {
    let peers = ACTIVE_TABS.get(this.doc);
    if (!peers) {
      peers = new Set();
      ACTIVE_TABS.set(this.doc, peers);
    }
    peers.add(this);
    this.doc.addEventListener("click", this.onClick, true);
    this.observer = new MutationObserver(() => {
      if (this.tab && !this.tabs.contains(this.tab)) {
        this.tabs.append(this.tab);
      }
      if (this.active) this.applyVisibility();
    });
    this.observer.observe(this.tabs, { childList: true });
  }

  applyVisibility() {
    const { panel, button } = this.view;
    panel.hidden = !this.active;
    button.setAttribute("aria-pressed", String(this.active));
    this.tab?.classList.toggle("active", this.active);
    if (!this.active) return;
    for (const item of this.tabs.querySelectorAll(
      ".tab:not(.plugin-agent-tab)")) {
      item.classList.remove("active");
    }
    const manager = this.doc.getElementById("pluginWindow");
    if (manager) manager.hidden = true;
    for (const id of ["editorPane", "empty"]) {
      const element = this.doc.getElementById(id);
      if (element) element.hidden = true;
    }
  }

  suspendPowerShell() {
    if (!this.column?.classList.contains("psm-mode")) return;
    // Hide the PowerShell surface without closing its native session.
    // Its own tab remains available and restores the original session.
    const pane = this.doc.getElementById("powershellManagerPane");
    if (pane) pane.hidden = true;
    this.column.classList.remove("psm-mode");
    this.doc.getElementById("explorerPowerShell")?.setAttribute(
      "aria-pressed", "false");
    for (const tab of this.tabs.querySelectorAll(".psm-tab")) {
      tab.classList.remove("active");
    }
  }

  open() {
    if (!this.view.enabled) return;
    for (const other of ACTIVE_TABS.get(this.doc) ?? []) {
      if (other !== this) other.deactivate();
    }
    this.suspendPowerShell();
    if (!this.tab) this.tabs.append(this.ensureTab());
    this.active = true;
    this.applyVisibility();
    this.onOpen?.();
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    this.applyVisibility();
  }

  close() {
    this.deactivate();
    this.tab?.remove();
    this.tab = null;
    this.onClose?.();
    const previous = this.tabs.querySelector(
      '.tab[data-tab-kind="tool"], .tab[data-tab-kind="document"]');
    previous?.click();
  }

  dispose() {
    this.deactivate();
    ACTIVE_TABS.get(this.doc)?.delete(this);
    this.observer?.disconnect();
    this.doc.removeEventListener("click", this.onClick, true);
    this.tab?.remove();
    this.tab = null;
  }
}
