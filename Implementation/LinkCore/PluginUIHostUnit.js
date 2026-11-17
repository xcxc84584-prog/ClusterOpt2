import { PluginShellApprovalObject } from
  "../object/PluginShellApprovalObject.js";
import { PluginExplorerObject } from
  "../object/PluginExplorerObject.js";
import { PluginModelTaskObject } from
  "../object/PluginModelTaskObject.js";
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
        snapshot, provider, localAgent: null, modelTask: null,
        explorerAccess: null, shellApproval: null
      };

      // Trusted host-side ToolBox; never run a file picker in a sandbox.
      if (provider.providerId === "cluster.ai-agent-mcp") {
        const access = new PluginExplorerObject(
          this.core, provider.providerId);
        if (!this.core.register(access)) {
          throw Error("Explorer access registration failed");
        }
        view.explorerAccess = access;
        const toolbox = this.doc.createElement("div");
        toolbox.className = "plugin-agent-toolbox";
        toolbox.style.cssText = "position:absolute;top:8px;right:16px;" +
          "z-index:20;font:12px system-ui;color:var(--ui-text-on-panel);";
        const trigger = this.doc.createElement("button");
        trigger.type = "button";
        trigger.textContent = "ToolBox ▾";
        trigger.setAttribute("aria-expanded", "false");
        const menu = this.doc.createElement("div");
        menu.hidden = true;
        menu.style.cssText = "margin-top:8px;padding:12px;min-width:260px;" +
          "background:var(--ui-panel,#101927);" +
          "border:1px solid var(--ui-border,#34516f);" +
          "border-radius:8px;box-shadow:0 10px 28px #0008;";
        trigger.addEventListener("click", () => {
          menu.hidden = !menu.hidden;
          trigger.setAttribute("aria-expanded", String(!menu.hidden));
        });
        const rootButton = this.doc.createElement("button");
        rootButton.type = "button";
        rootButton.textContent = "選取本地資料夾 / Select folder";
        const rootStatus = this.doc.createElement("p");
        rootStatus.setAttribute("role", "status");
        rootStatus.style.cssText = "margin:8px 0;overflow-wrap:anywhere;";
        rootButton.addEventListener("click", async () => {
          // Called synchronously from a real host user gesture.
          if (!this.doc.defaultView.showDirectoryPicker) {
            rootStatus.textContent = "File System Access unavailable";
            return;
          }
          try {
            const handle = await this.doc.defaultView.showDirectoryPicker({
              mode: "read"
            });
            // Browser handles are the only filesystem authority.
            // Browsers do not disclose a folder's absolute OS path.
            if (await handle.queryPermission({ mode: "read" }) !==
                "granted") {
              rootStatus.textContent = "未取得資料夾授權";
              access.audit("BrowserPermissionDenied", 403);
              return;
            }
            const entered = this.doc.defaultView.prompt(
              "已選取：" + handle.name +
              "\n輸入絕對路徑確認（不會授權其他路徑）：", "");
            if (entered === null) return;
            const path = entered.trim();
            const unified = path.replace(/\\/g, "/");
            const parts = unified.split("/").filter(Boolean);
            const basename = parts.at(-1);
            const absolute = /^[A-Za-z]:\//.test(unified) ||
              unified.startsWith("//") || unified.startsWith("/");
            if (!absolute || path.length > 512 ||
                !basename ||
                basename.toLowerCase() !== handle.name.toLowerCase()) {
              rootStatus.textContent =
                "絕對路徑無效或與所選資料夾名稱不符";
              access.audit("PathConfirmationRejected", 400);
              return;
            }
            view.shellApproval?.revoke();
            view.localAgent?.disableShellBridge();
            access.setRoot(handle, path);
            rootStatus.textContent =
              "已取得所選資料夾授權：" + access.label;
            for (const checkbox of menu.querySelectorAll(
              'input[type="checkbox"]')) checkbox.checked = false;
          } catch (error) {
            if (error?.name !== "AbortError") {
              rootStatus.textContent = "Folder selection rejected";
              access.audit("PickerFailed", 403);
            }
          }
        });
        menu.append(rootButton, rootStatus);
        const rights = [
          ["ps", "PowerShell (PR14.7)"],
          ["create", "File Create"],
          ["update", "File Update"],
          ["read", "File Read"],
          ["delete", "File Delete"]
        ];
        for (const [name, label] of rights) {
          const row = this.doc.createElement("label");
          row.style.cssText = "display:flex;align-items:center;" +
            "gap:8px;padding:7px 0;cursor:pointer;";
          const checkbox = this.doc.createElement("input");
          checkbox.type = "checkbox";
          checkbox.dataset.right = name;
          checkbox.disabled = false;
          checkbox.addEventListener("change", async () => {
            try {
              if (checkbox.checked && name !== "read" &&
                  name !== "ps") {
                const selected = access.root;
                if (!selected ||
                    await selected.requestPermission({
                      mode: "readwrite"
                    }) !== "granted") {
                  throw Error("Write permission denied");
                }
              }
              const enabled = checkbox.checked;
              if (name === "ps") {
                if (!view.shellApproval || !view.localAgent) {
                  throw Error("Shell adapter unavailable");
                }
                if (enabled) {
                  const bridge = view.localAgent.registerShellBridge(
                    view.shellApproval.id);
                  if (!bridge.ok) throw Error("Bridge unavailable");
                } else {
                  view.localAgent.disableShellBridge();
                }
                view.shellApproval.setEnabled(enabled);
              }
              access.setRight(name, enabled);
            } catch {
              checkbox.checked = false;
              if (name === "ps") {
                view.shellApproval?.revoke();
                view.localAgent?.disableShellBridge();
              }
              access.audit("PermissionRejected", 403);
            }
          });
          row.append(checkbox, this.doc.createTextNode(label));
          menu.append(row);
        }
        const revoke = this.doc.createElement("button");
        revoke.type = "button";
        revoke.textContent = "撤銷全部 / Revoke all";
        revoke.addEventListener("click", () => {
          access.revoke();
          view.shellApproval?.revoke();
          view.localAgent?.disableShellBridge();
          rootStatus.textContent = "";
          for (const checkbox of menu.querySelectorAll(
            'input[type="checkbox"]')) checkbox.checked = false;
        });
        menu.append(revoke);
        toolbox.append(trigger, menu);
        panel.append(toolbox);
        view.resetToolBox = () => {
          menu.hidden = true;
          trigger.setAttribute("aria-expanded", "false");
          rootStatus.textContent = "";
          for (const checkbox of menu.querySelectorAll(
            'input[type="checkbox"]')) checkbox.checked = false;
        };
      }
      if (provider.permissions.includes("network.request") &&
          provider.permissions.includes("local-agent.pair")) {
        const agent = new PluginLocalAgentObject(
          this.core, provider.providerId, this.doc);
        if (!this.core.register(agent)) {
          throw Error("Local Agent object registration failed");
        }
        view.localAgent = agent;
        pendingAgent = agent;
        if (view.explorerAccess) {
          const shell = new PluginShellApprovalObject(
            this.core, provider.providerId, agent.id,
            view.explorerAccess, this.doc);
          if (!this.core.register(shell)) {
            throw Error("Shell approval registration failed");
          }
          view.shellApproval = shell;
        }
        if (provider.permissions.includes("model.configure") &&
            provider.permissions.includes("model.task")) {
          const task = new PluginModelTaskObject(
            this.core, provider.providerId, agent.id, update => {
              frame.contentWindow?.postMessage({
                type: "cluster-model-event", update
              }, "*");
            });
          if (!this.core.register(task)) {
            throw Error("Model Task object registration failed");
          }
          view.modelTask = task;
          agent.modelTaskId = task.id;
        }
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
          const modelActions = {
            "cluster-model-configure": "configure",
            "cluster-model-info": "modelInfo",
            "cluster-model-submit": "submit",
            "cluster-model-cancel": "cancel"
          };
          const modelAction = Object.hasOwn(modelActions, kind) ?
            modelActions[kind] : null;
          if (kind === "cluster-explorer-request" &&
              view.explorerAccess) {
            const allowed = ["status", "list", "read", "create",
              "update", "delete"];
            const operation = event.data?.action;
            if (!allowed.includes(operation)) return;
            const data = event.data?.payload;
            if (!data || typeof data !== "object" ||
                Array.isArray(data)) return;
            const requestId = event.data?.requestId;
            if (typeof requestId !== "string" ||
                requestId.length > 64) return;
            const response = await this.core.request("ui",
              view.explorerAccess.id, operation, {
                path: data.path, content: data.content
              }, { origin: "user" });
            frame.contentWindow?.postMessage({
              type: "cluster-explorer-response", requestId,
              action: operation, ok: response.ok,
              status: response.status,
              value: response.ok ? response.value : null
            }, "*");
            return;
          }
          if (!action && !modelAction) return;
          const target = modelAction ? view.modelTask : agent;
          if (!target) return;
          const data = modelAction === "submit" ? {
            prompt: event.data.prompt
          } : {};
          // Each operation is checked by HubUnit and the target OCDA
          // Object against currently granted capabilities.
          const result = await this.core.request("ui", target.id,
            modelAction ?? action, data, { origin: "user" });
          if (action) publish({ state: agent.state });
          frame.contentWindow?.postMessage({
            type: modelAction ? "cluster-model-response" :
              "cluster-local-agent-result",
            action: modelAction ?? action,
            status: result.status, ok: result.ok,
            taskActive: modelAction ?
              Boolean(view.modelTask?.activeId) : undefined
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
        view.shellApproval?.revoke();
        view.localAgent?.disableShellBridge();
        if (view.shellApproval) {
          this.core.unregister(view.shellApproval.id);
        }
        view.explorerAccess?.revoke();
        if (view.explorerAccess) {
          this.core.unregister(view.explorerAccess.id);
        }
        if (view.modelTask) this.core.unregister(view.modelTask.id);
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
        if (pendingAgent.modelTaskId) {
          this.core.unregister(pendingAgent.modelTaskId);
        }
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
      view.explorerAccess?.revoke();
      view.shellApproval?.revoke();
      view.localAgent?.disableShellBridge();
      view.resetToolBox?.();
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
