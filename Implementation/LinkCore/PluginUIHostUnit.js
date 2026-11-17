import { PluginLocalAgentObject } from
  "../object/PluginLocalAgentObject.js";

/**
 * Generic plugin UI mounting extension for PR14.3.
 *
 * Only the host owns toolbar controls and the workspace mount. The
 * untrusted HTML runs in an opaque-origin frame with no host API.
 * UI messages request host-owned actions; only an explicitly granted
 * network capability lets the host route them through HubUnit.
 */
const UI_CSP = "default-src 'none'; script-src 'unsafe-inline'; " +
  "style-src 'unsafe-inline'; img-src data:; connect-src 'none'; " +
  "font-src 'none'; worker-src 'none'; frame-src 'none'; " +
  "object-src 'none'; form-action 'none'; base-uri 'none'";

function decodeAsset(snapshot, path) {
  const data = snapshot?.files?.[path];
  if (typeof data !== "string") throw Error("Missing UI asset");
  const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function readLocale(core) {
  const result = core.readProperty("ui", "Language");
  return result.ok && result.value === "en" ? "en" : "zh-Hant";
}

function safeI18n(snapshot, locale) {
  const path = "locales/" + locale + ".json";
  if (!Object.hasOwn(snapshot.files, path)) return {};
  const raw = decodeAsset(snapshot, path);
  if (raw.length > 16384) throw Error("Locale budget exceeded");
  const dictionary = JSON.parse(raw);
  if (!dictionary || Array.isArray(dictionary) ||
      typeof dictionary !== "object" ||
      Object.keys(dictionary).length > 100 ||
      Object.entries(dictionary).some(([key, value]) =>
        !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) ||
        typeof value !== "string" || value.length > 512)) {
    throw Error("Invalid locale dictionary");
  }
  return dictionary;
}

export class PluginUIHostUnit {
  constructor(core, doc) {
    this.core = core;
    this.doc = doc;
    this.views = new Map();
  }

  mount(snapshot, provider) {
    const manifest = JSON.parse(snapshot.manifestText);
    if (!manifest.uiEntry || !this.doc) {
      return { ok: true, status: 200 };
    }
    if (this.views.has(provider.providerId)) {
      return { ok: false, status: 409 };
    }
    const toolbar = this.doc.querySelector(".header-utility");
    const workspace = this.doc.getElementById("workspace");
    if (!toolbar || !workspace) {
      return { ok: false, status: 503 };
    }
    let pendingAgent = null;
    try {
      const html = decodeAsset(snapshot, manifest.uiEntry);
      if (html.length > 262144) throw Error("UI too large");
      const labels = {
        "zh-Hant": safeI18n(snapshot, "zh-Hant"),
        en: safeI18n(snapshot, "en")
      };
      const frame = this.doc.createElement("iframe");
      frame.className = "plugin-extension-frame";
      frame.title = manifest.name;
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("aria-label", manifest.name);
      frame.srcdoc = '<meta http-equiv="Content-Security-Policy" ' +
        'content="' + UI_CSP + '">' + html;
      const panel = this.doc.createElement("section");
      panel.style.cssText = "position:absolute;inset:0;z-index:12;" +
        "background:var(--ui-editor,#101723);min-height:0;";
      frame.style.cssText = "width:100%;height:100%;display:block;" +
        "border:0;background:#0b1019;";
      panel.className = "plugin-extension-panel";
      panel.hidden = true;
      panel.setAttribute("aria-label", manifest.name);
      panel.append(frame);
      const button = this.doc.createElement("button");
      button.type = "button";
      button.className = "plugin-extension-button";
      button.textContent = "✧ " + manifest.name.split(" MCP(")[0];
      button.style.cssText = "margin-left:8px;max-width:175px;" +
        "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" +
        "background:var(--ui-control);color:var(--ui-text-on-control);" +
        "border:1px solid var(--ui-border);padding:7px 11px;" +
        "border-radius:7px;";
      button.title = manifest.name;
      button.setAttribute("aria-controls", "plugin-extension-panel-" +
        provider.objectId);
      button.setAttribute("aria-pressed", "false");
      panel.id = "plugin-extension-panel-" + provider.objectId;
      const view = {
        button, panel, frame, labels, enabled: true,
        snapshot, provider, localAgent: null
      };
      if (provider.permissions.includes("network.request") &&
          provider.permissions.includes("local-agent.pair")) {
        const agent = new PluginLocalAgentObject(
          this.core, provider.providerId, this.doc);
        if (!this.core.register(agent)) {
          throw Error("Local Agent object registration failed");
        }
        view.localAgent = agent;
        pendingAgent = agent;
        const publish = response => {
          frame.contentWindow?.postMessage({
            type: "cluster-local-agent-status",
            state: response.state
          }, "*");
        };
        agent.onState = publish;
        const receive = async event => {
          if (event.source !== frame.contentWindow ||
              event.origin !== "null" ||
              !this.views.has(provider.providerId) ||
              !view.enabled) return;
          const kind = event.data?.type;
          const actions = {
            "cluster-local-agent-pair": "pair",
            "cluster-local-agent-ping": "ping",
            "cluster-local-agent-disconnect": "disconnect"
          };
          const action = Object.hasOwn(actions, kind) ?
            actions[kind] : null;
          if (!action) return;
          // The OCDA Object rechecks the live grant on every Request
          // and writes an EHU for rejected attempts.
          const result = await this.core.request("ui", agent.id,
            action, {}, { origin: "user" });
          publish({ state: agent.state });
          frame.contentWindow?.postMessage({
            type: "cluster-local-agent-result",
            action, status: result.status, ok: result.ok
          }, "*");
        };
        this.doc.defaultView.addEventListener("message", receive);
        view.unlistenAgent = () =>
          this.doc.defaultView.removeEventListener("message", receive);
      }
      const sync = () => {
        const locale = readLocale(this.core);
        if (!frame.contentWindow) return;
        frame.contentWindow.postMessage({
          type: "cluster-plugin-locale",
          locale, labels: labels[locale]
        }, "*");
        const root = this.doc.defaultView.getComputedStyle(
          this.doc.documentElement);
        const read = key => root.getPropertyValue(key).trim();
        frame.contentWindow.postMessage({
          type: "cluster-plugin-theme",
          colors: {
            background: read("--ui-editor"),
            panel: read("--ui-panel"),
            text: read("--ui-text-on-panel"),
            border: read("--ui-border"),
            control: read("--ui-control")
          }
        }, "*");
      };
      view.sync = sync;
      const open = () => {
        if (!view.enabled) return;
        const next = panel.hidden;
        for (const other of this.views.values()) {
          other.panel.hidden = true;
          other.button.setAttribute("aria-pressed", "false");
        }
        panel.hidden = !next;
        button.setAttribute("aria-pressed", String(next));
        if (next) sync();
      };
      button.addEventListener("click", open);
      frame.addEventListener("load", sync);
      const closeForWorkbench = event => {
        if (!event.target.closest?.(
          "#tabs .tab, #explorerPowerShell, #pluginBtn")) return;
        panel.hidden = true;
        button.setAttribute("aria-pressed", "false");
      };
      this.doc.addEventListener("click", closeForWorkbench);
      const localeObserver = new MutationObserver(sync);
      localeObserver.observe(this.doc.documentElement, {
        attributes: true, attributeFilter: ["lang", "style", "class"]
      });
      view.dispose = () => {
        localeObserver.disconnect();
        this.doc.removeEventListener("click", closeForWorkbench);
        view.unlistenAgent?.();
        view.localAgent?.close();
        if (view.localAgent) this.core.unregister(view.localAgent.id);
        frame.srcdoc = "";
        panel.remove();
        button.remove();
      };
      toolbar.append(button);
      workspace.style.position = "relative";
      workspace.append(panel);
      this.views.set(provider.providerId, view);
      return { ok: true, status: 200 };
    } catch {
      if (pendingAgent) {
        pendingAgent.close();
        this.core.unregister(pendingAgent.id);
      }
      return { ok: false, status: 400 };
    }
  }

  setEnabled(providerId, enabled) {
    const view = this.views.get(providerId);
    if (!view) return;
    view.enabled = enabled;
    view.button.hidden = !enabled;
    if (!enabled) {
      view.localAgent?.close();
      view.panel.hidden = true;
      view.button.setAttribute("aria-pressed", "false");
    }
  }

  unmount(providerId) {
    const view = this.views.get(providerId);
    if (!view) return;
    view.dispose();
    this.views.delete(providerId);
  }
}
