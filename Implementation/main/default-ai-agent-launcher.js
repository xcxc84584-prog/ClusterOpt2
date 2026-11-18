/**
 * Built-in AI Agent availability is an unprivileged host-owned launcher.
 * Its first-party UI is present by default. Executable provider code and
 * ALL capabilities still require an explicit user action and review.
 */
const ID = "cluster.ai-agent-mcp";
const BASE = "./Implementation/plugins/ai-agent-mcp/";
const ASSETS = Object.freeze([
  "plugin.json", "worker.js", "index.html", "README.md",
  "locales/en.json", "locales/zh-Hant.json"
]);
const PERMISSIONS = Object.freeze([
  "network.request", "local-agent.pair", "model.configure",
  "model.task", "shell.execute", "mcp.read"
]);

function encode(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

async function trustedSnapshot(win) {
  const files = {};
  for (const asset of ASSETS) {
    const response = await win.fetch(BASE + asset, { cache: "no-store" });
    if (!response.ok) throw Error("Missing bundled asset: " + asset);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 262144) {
      throw Error("Bundled asset exceeds allowed size");
    }
    files[asset] = encode(bytes);
  }
  const manifestText = new TextDecoder().decode(
    Uint8Array.from(atob(files["plugin.json"]),
      c => c.charCodeAt(0)));
  const parsed = JSON.parse(manifestText);
  if (parsed.provider?.providerId !== ID ||
      JSON.stringify(parsed.provider.permissions) !==
        JSON.stringify(PERMISSIONS)) {
    throw Error("Unexpected bundled provider contract");
  }
  return {
    format: "cluster-plugin-folder", formatVersion: 1,
    manifestText, files
  };
}

export async function mountDefaultAIAgentLauncher(core, doc, refresh) {
  const host = doc.querySelector(".header-utility");
  if (!host) return { ok: false, status: 503 };
  const saved = await core.listReviewedPlugins();
  if (!saved.ok) return saved;
  const previous = saved.value.find(item => item.providerId === ID);
  // A dismissal is scoped to this page only, never a persistent opt-out.
  // Previous consent is not inferred from an old disabled/opt-out record.
  if (previous?.enabled === true && !core.uru.getProvider(ID)) {
    try {
      const snapshot = await trustedSnapshot(doc.defaultView);
      const installed = await core.pluginHostInstaller.install(snapshot, {
        consented: true, approvedPermissions: [...PERMISSIONS]
      });
      if (installed.ok) {
        refresh?.();
        return { ok: true, status: 200, value: "restored" };
      }
    } catch {
      // Keep the default launcher visible if restore fails.
    }
  }
  if (core.uru.getProvider(ID) ||
      doc.getElementById("pluginBundledAgentLauncher")) {
    return { ok: true, status: 200, value: "already-present" };
  }

  const container = doc.createElement("span");
  container.id = "pluginBundledAgentLauncher";
  container.style.cssText = "display:inline-flex;align-items:center;" +
    "gap:3px;margin-left:8px;";
  const open = doc.createElement("button");
  open.type = "button";
  open.textContent = "✧ AI Agent";
  open.title = "Install the bundled AI Agent after capability review";
  open.style.cssText = "padding:7px 11px;border:1px solid " +
    "var(--ui-border);border-radius:7px;background:var(--ui-control);" +
    "color:var(--ui-text-on-control);";
  const remove = doc.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.title = "Hide AI Agent until page reload";
  remove.setAttribute("aria-label", "Hide AI Agent for this page");
  remove.style.cssText = "padding:5px;border:0;background:transparent;" +
    "color:var(--ui-text-on-panel);";
  const status = doc.createElement("span");
  status.setAttribute("role", "status");
  status.style.cssText = "font-size:11px;";
  status.hidden = true;
  remove.addEventListener("click", async event => {
    if (!event.isTrusted) return;
    // Hide only for this page view. Reload always brings it back.
    container.remove();
    refresh?.();
  });
  open.addEventListener("click", async event => {
    if (!event.isTrusted || open.disabled) return;
    if (!doc.defaultView.confirm(
      "啟用 AI AGENT MCP(ChatGPT)？\n" +
      "首次啟動需同意：network.request、local-agent.pair、" +
      "model.configure、model.task、shell.execute、mcp.read。\n" +
      "這不會直接授權檔案或 PowerShell 執行；ToolBox 仍需逐項同意。" +
      "\nEnable bundled AI Agent with the listed capabilities?")) return;
    open.disabled = true;
    try {
      const snapshot = await trustedSnapshot(doc.defaultView);
      const result = await core.pluginHostInstaller.install(snapshot, {
        consented: true, approvedPermissions: [...PERMISSIONS]
      });
      if (!result.ok) throw Error("Plugin activation " + result.status);
      container.remove();
      refresh?.();
      const installed = [...doc.querySelectorAll(
        ".plugin-extension-button")].find(node =>
          node.title === "AI AGENT MCP(ChatGPT)");
      installed?.click();
    } catch {
      status.textContent = "Cannot activate bundled AI Agent";
      status.hidden = false;
    } finally {
      open.disabled = false;
    }
  });
  container.append(open, remove, status);
  host.append(container);
  return { ok: true, status: 200, value: "ready-for-review" };
}
