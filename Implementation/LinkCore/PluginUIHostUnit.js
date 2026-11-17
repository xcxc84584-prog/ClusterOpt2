/**
 * Generic plugin UI mounting extension for PR14.3.
 *
 * Only the host owns toolbar controls and the workspace mount. The
 * untrusted HTML runs in an opaque-origin frame with no host API.
 * No iframe message is accepted as an authorization or Hub Request.
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
        snapshot, provider
      };
      const sync = () => {
        const locale = readLocale(this.core);
        if (frame.contentWindow) {
          frame.contentWindow.postMessage({
            type: "cluster-plugin-locale",
            locale, labels: labels[locale]
          }, "*");
        }
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
      const localeObserver = new MutationObserver(sync);
      localeObserver.observe(this.doc.documentElement, {
        attributes: true, attributeFilter: ["lang"]
      });
      view.dispose = () => {
        localeObserver.disconnect();
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
      return { ok: false, status: 400 };
    }
  }

  setEnabled(providerId, enabled) {
    const view = this.views.get(providerId);
    if (!view) return;
    view.enabled = enabled;
    view.button.hidden = !enabled;
    if (!enabled) {
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
