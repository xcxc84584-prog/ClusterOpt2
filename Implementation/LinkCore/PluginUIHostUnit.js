import { PluginWorkbenchTabUnit } from "./PluginWorkbenchTabUnit.js";
import { downloadAgentQuickSetup, downloadMCPQuickSetup } from
  "../main/plugin-agent-download.js";
import { PluginMCPReadOnlyObject } from
  "../object/PluginMCPReadOnlyObject.js";
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
    let pendingExplorer = null;
    let pendingShell = null;
    let pendingMCP = null;
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
        explorerAccess: null, shellApproval: null,
        mcpReadOnly: null, workbenchTab: null
      };

      // Trusted host-side ToolBox; never run a file picker in a sandbox.
      if (provider.providerId === "cluster.ai-agent-mcp") {
        const access = new PluginExplorerObject(
          this.core, provider.providerId);
        if (!this.core.register(access)) {
          throw Error("Explorer access registration failed");
        }
        view.explorerAccess = access;
        pendingExplorer = access;
        const toolbox = this.doc.createElement("div");
        toolbox.className = "plugin-agent-toolbox";
        toolbox.style.cssText = "position:absolute;top:62px;right:16px;" +
          "z-index:20;font:12px system-ui;color:var(--ui-text-on-panel);" +
          "max-width:min(380px,calc(100% - 32px));";
        const trigger = this.doc.createElement("button");
        trigger.type = "button";
        trigger.textContent = "⚙ ToolBox ▾";
        trigger.style.cssText = "padding:8px 12px;border-radius:6px;" +
          "background:var(--ui-control,#1c2939);" +
          "border:1px solid var(--ui-border,#44546b);" +
          "color:var(--ui-text-on-panel,#dce6f5);cursor:pointer;";
        trigger.setAttribute("aria-expanded", "false");
        const menu = this.doc.createElement("div");
        menu.hidden = true;
        menu.style.cssText = "margin-top:8px;padding:16px;" +
          "width:340px;max-width:100%;max-height:65vh;overflow:auto;" +
          "background:var(--ui-panel,#131c29);" +
          "border:1px solid var(--ui-border,#34516f);" +
          "border-radius:10px;box-shadow:0 18px 48px #0009;";
        const title = this.doc.createElement("strong");
        title.textContent = "TOOLBOX  /  LOCAL ACCESS";
        title.style.cssText = "display:block;font-size:12px;" +
          "letter-spacing:.08em;margin-bottom:8px;";
        const helper = this.doc.createElement("p");
        helper.textContent = "權限僅限本次選取的資料夾，關閉或斷線即撤銷。";
        helper.style.cssText = "opacity:.78;margin:0 0 12px;" +
          "line-height:1.5;font-size:12px;";
        menu.append(title,helper);
        trigger.addEventListener("click", () => {
          menu.hidden = !menu.hidden;
          trigger.setAttribute("aria-expanded", String(!menu.hidden));
        });
        const rootButton = this.doc.createElement("button");
        rootButton.type = "button";
        rootButton.textContent = "▣ 選取本地資料夾 / Select folder";
        rootButton.style.cssText = "display:block;width:100%;" +
          "text-align:left;padding:10px 12px;border-radius:6px;" +
          "border:1px solid var(--ui-border,#45617d);" +
          "background:var(--ui-control,#22344c);" +
          "color:var(--ui-text-on-panel,#dce6f5);cursor:pointer;";
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
            view.mcpReadOnly?.revoke();
            view.localAgent?.disableShellBridge();
            view.localAgent?.disableReadBridge();
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
        const permissionsTitle = this.doc.createElement("h3");
        permissionsTitle.textContent = "PERMISSIONS";
        permissionsTitle.style.cssText = "margin:14px 0 5px;font-size:11px;" +
          "letter-spacing:.1em;opacity:.8;border-top:1px solid " +
          "var(--ui-border,#435269);padding-top:12px;";
        menu.append(permissionsTitle);
        const rights = [
          ["ps", "PowerShell"],
          ["mcp", "MCP Read-only"],
          ["create", "File Create"],
          ["update", "File Update"],
          ["read", "File Read"],
          ["delete", "File Delete"]
        ];
        for (const [name, label] of rights) {
          const row = this.doc.createElement("label");
          row.style.cssText = "display:flex;align-items:center;" +
            "gap:10px;padding:9px;border-radius:6px;cursor:pointer;" +
            "border:1px solid transparent;";
          row.addEventListener("mouseenter", () =>
            row.style.background = "var(--ui-control,#1b2b40)");
          row.addEventListener("mouseleave", () =>
            row.style.background = "transparent");
          const checkbox = this.doc.createElement("input");
          checkbox.type = "checkbox";
          checkbox.dataset.right = name;
          checkbox.disabled = false;
          checkbox.addEventListener("change", async () => {
            try {
              if (checkbox.checked && name !== "read" &&
                  name !== "ps" && name !== "mcp") {
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
                if (enabled && !this.core.checkPluginPermission(
                  provider.providerId, "shell.execute")) {
                  throw Error("Shell capability not granted");
                }
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
              } else if (name === "mcp") {
                if (enabled && !this.core.checkPluginPermission(
                  provider.providerId, "mcp.read")) {
                  throw Error("MCP capability not granted");
                }
                if (!view.mcpReadOnly || !view.localAgent) {
                  throw Error("MCP adapter unavailable");
                }
                if (enabled) {
                  const bridge = view.localAgent.registerReadBridge(
                    view.mcpReadOnly.id);
                  if (!bridge.ok) throw Error("MCP bridge unavailable");
                } else {
                  view.localAgent.disableReadBridge();
                }
                view.mcpReadOnly.setEnabled(enabled);
              }
              if (name !== "mcp") access.setRight(name, enabled);
            } catch {
              checkbox.checked = false;
              if (name === "ps") {
                view.shellApproval?.revoke();
                view.localAgent?.disableShellBridge();
              }
              if (name === "mcp") {
                view.mcpReadOnly?.revoke();
                view.localAgent?.disableReadBridge();
              }
              access.audit("PermissionRejected", 403);
            }
          });
          row.append(checkbox, this.doc.createTextNode(label));
          menu.append(row);
        }
        const revoke = this.doc.createElement("button");
        revoke.type = "button";
        revoke.textContent = "✕ 撤銷全部 / Revoke all";
        revoke.style.cssText = "width:100%;margin-top:12px;padding:9px;" +
          "background:#2c1b23;color:#f9c4cc;" +
          "border:1px solid #804252;border-radius:6px;cursor:pointer;";
        revoke.addEventListener("click", () => {
          access.revoke();
          view.shellApproval?.revoke();
          view.mcpReadOnly?.revoke();
          view.localAgent?.disableShellBridge();
          view.localAgent?.disableReadBridge();
          rootStatus.textContent = "";
          for (const checkbox of menu.querySelectorAll(
            'input[type="checkbox"]')) checkbox.checked = false;
        });
        menu.append(revoke);
        const shellOutput = this.doc.createElement("pre");
        shellOutput.hidden = true;
        shellOutput.setAttribute("role", "status");
        shellOutput.style.cssText = "max-height:210px;max-width:360px;" +
          "overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;" +
          "border-top:1px solid var(--ui-border);padding-top:8px;";
        menu.append(shellOutput);
        view.showShellResult = message => {
          const outcome = message?.result;
          const code = outcome?.exitCode;
          const stdout = typeof outcome?.stdout === "string" ?
            outcome.stdout : "";
          const stderr = typeof outcome?.stderr === "string" ?
            outcome.stderr : "";
          shellOutput.textContent = [
            "PowerShell exit: " + String(code ?? "error"),
            stdout.slice(0, 32768), stderr.slice(0, 32768)
          ].join("\n").slice(0, 65536);
          shellOutput.hidden = false;
          menu.hidden = false;
          trigger.setAttribute("aria-expanded", "true");
        };
        toolbox.append(trigger, menu);
        panel.append(toolbox);
        view.resetBridgeToolBox = () => {
          for (const name of ["ps", "mcp"]) {
            const checkbox = menu.querySelector(
              '[data-right="' + name + '"]');
            if (checkbox) checkbox.checked = false;
          }
        };
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
          pendingShell = shell;
          const read = new PluginMCPReadOnlyObject(
            this.core, provider.providerId, agent.id);
          if (!this.core.register(read)) {
            throw Error("MCP read object registration failed");
          }
          view.mcpReadOnly = read;
          pendingMCP = read;
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
          if (response.state === "disconnected") {
            const hadBridge = view.shellApproval?.active ||
              view.mcpReadOnly?.enabled;
            if (hadBridge) {
              view.shellApproval?.revoke();
              view.mcpReadOnly?.revoke();
              view.localAgent?.disableShellBridge();
              view.localAgent?.disableReadBridge();
              view.explorerAccess?.setRight("ps", false);
              view.resetBridgeToolBox?.();
            }
          }
          frame.contentWindow?.postMessage({
            type: "cluster-local-agent-status",
            state: response.state
          }, "*");
        };
        agent.onState = publish;
        agent.onShellResult = message => {
          if (view.enabled) view.showShellResult?.(message);
        };
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
        for (const other of this.views.values()) {
          if (other !== view) other.workbenchTab?.deactivate();
        }
        if (view.workbenchTab) {
          view.workbenchTab.open();
        } else {
          const next = panel.hidden;
          panel.hidden = !next;
          button.setAttribute("aria-pressed", String(next));
        }
        if (!panel.hidden) sync();
      };
      button.addEventListener("click", open);
      frame.addEventListener("load", sync);
      const closeForWorkbench = event => {
        if (!event.target.closest?.(
          "#tabs .tab, #explorerPowerShell, #pluginBtn"))
          return;
        if (view.workbenchTab) {
          if (!event.target.closest?.(".plugin-agent-tab")) {
            view.workbenchTab.deactivate();
          }
        } else {
          panel.hidden = true;
          button.setAttribute("aria-pressed", "false");
        }
      };
      this.doc.addEventListener("click", closeForWorkbench);
      const localeObserver = new MutationObserver(sync);
      localeObserver.observe(this.doc.documentElement, {
        attributes: true, attributeFilter: ["lang", "style", "class"]
      });
      view.dispose = () => {
        localeObserver.disconnect();
        view.workbenchTab?.dispose();
        view.unlistenQuickSetup?.();
        this.doc.removeEventListener("click", closeForWorkbench);
        view.unlistenAgent?.();
        view.localAgent?.close();
        view.shellApproval?.revoke();
        view.mcpReadOnly?.revoke();
        view.localAgent?.disableShellBridge();
        view.localAgent?.disableReadBridge();
        if (view.mcpReadOnly) {
          this.core.unregister(view.mcpReadOnly.id);
        }
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
      if (provider.providerId === "cluster.ai-agent-mcp") {
        view.workbenchTab = new PluginWorkbenchTabUnit(
          this.doc, view, sync);
        view.workbenchTab.attach();
      }
      if (provider.providerId === "cluster.ai-agent-mcp") {
        const onQuickSetup = event => {
          if (event.source !== frame.contentWindow) return;
          if (event.data?.type === "cluster-plugin-panel-close") {
            view.workbenchTab?.close();
            return;
          }
          const action = event.data?.type;
          if (action !== "cluster-plugin-quick-setup" &&
              action !== "cluster-plugin-mcp-quick-setup") return;
          const download = action === "cluster-plugin-quick-setup" ?
            downloadAgentQuickSetup : downloadMCPQuickSetup;
          void download(this.doc).catch(() =>
            this.core.omu.record("EHU", "PluginUIHost",
              "Plugin.QuickSetupDownload", 503, provider.providerId));
        };
        this.doc.defaultView.addEventListener("message", onQuickSetup);
        view.unlistenQuickSetup = () => this.doc.defaultView
          .removeEventListener("message", onQuickSetup);
      }
      this.views.set(provider.providerId, view);
      return { ok: true, status: 200 };
    } catch {
      if (pendingMCP) this.core.unregister(pendingMCP.id);
      if (pendingShell) this.core.unregister(pendingShell.id);
      if (pendingExplorer) this.core.unregister(pendingExplorer.id);
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
      view.mcpReadOnly?.revoke();
      view.localAgent?.disableShellBridge();
      view.localAgent?.disableReadBridge();
      view.resetToolBox?.();
      if (view.workbenchTab) view.workbenchTab.deactivate();
      else {
        view.panel.hidden = true;
        view.button.setAttribute("aria-pressed", "false");
      }
    }
  }

  unmount(providerId) {
    const view = this.views.get(providerId);
    if (!view) return;
    view.dispose();
    this.views.delete(providerId);
  }
}
