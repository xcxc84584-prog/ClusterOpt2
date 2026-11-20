import { downloadPluginTemplate } from
  "./plugin-template-download.js";
import { describePluginRPCScopes } from
  "./plugin-rpc-scope-review.js";
import {
  downloadAgentPackage,
  downloadAgentQuickSetup,
  downloadMCPQuickSetup
} from "./plugin-agent-download.js";

/**
 * Resources: independent scroll panes and user-initiated data-only exports.
 * Provider Manifests do not contain binary package download URLs. Never
 * represent a manifest export as an installable plugin.
 */
function el(doc,tag,cls="",value) {
  const item=doc.createElement(tag);
  if(cls)item.className=cls;
  if(value!==undefined)item.textContent=String(value);
  return item;
}
function button(doc,text,callback) {
  const item=el(doc,"button","pm-mini",text);
  item.type="button";
  item.addEventListener("click",callback);
  return item;
}
export function downloadJSON(doc,filename,value) {
  const win=doc.defaultView;
  const blob=new win.Blob([JSON.stringify(value,null,2)+"\n"],
    {type:"application/json;charset=utf-8"});
  const url=win.URL.createObjectURL(blob);
  const link=el(doc,"a");
  link.href=url;link.download=filename;
  doc.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  }
}

/**
 * Reviewed downloadable packages are explicit catalogue entries.
 * A locally selected file is verified against the shipped source before
 * mounting the trusted module; never evaluate file contents.
 */
const PLUGINS = Object.freeze([{
  id: "cluster.sample.multilang-highlighter",
  nameZh: "多語言語法著色器",
  nameEn: "Multi-language Syntax Highlighter",
  descriptionZh: "JS、TS、Python、C/C++、Java、CSS、HTML、JSON、SQL。",
  descriptionEn: "Syntax tokens for JS, TS, Python, C/C++, Java, CSS, HTML, JSON and SQL.",
  file: "multilang-highlighter.js",
  url: "./Implementation/plugins/multilang-highlighter.js",
  service: "editor.syntax.highlight",
  version: "1.1.0"
}, {
  id: "cluster.template.plugin-author",
  kind: "template",
  nameZh: "插件製作範本",
  nameEn: "Plugin Development Template",
  descriptionZh: "HTML／CSS／JS 範本。製作前請查看 API 列表中的" +
    " Request 輸入與 Response 輸出契約。",
  descriptionEn: "HTML/CSS/JS project scaffold. Check API List" +
    " Request inputs and Response outputs before development.",
  service: "plugin.author.template",
  version: "1.0.0"
}, {
  id: "cluster.ai-agent-mcp",
  kind: "folder-package",
  nameZh: "AI Agent MCP（ChatGPT）",
  nameEn: "AI Agent MCP (ChatGPT)",
  descriptionZh: "完整插件包及新版 CMD 安裝程式（舊連線可選擇沿用／註銷）。可下載 ZIP 裝載資料夾；操作需明確授權。",
  descriptionEn: "AI Agent package and updated CMD installers. " +
    "Reuse or revoke old connections; extract ZIP and mount with consent.",
  service: "cluster.ai-agent.status",
  version: "1.0.0"
}]);

async function mountReviewedFile(doc, plugin, file, core) {
  if (file.name !== plugin.file || file.size > 262144) {
    return {ok: false, status: 400};
  }
  const response = await doc.defaultView.fetch(plugin.url,
    {cache: "no-store"});
  if (!response.ok) return {ok: false, status: 503};
  const trustedSource = await response.text();
  const userSource = await file.text();
  if (trustedSource !== userSource) {
    return {ok: false, status: 403};
  }
  // File text is not imported or executed. Only the bundled reviewed
  // module can register an Object and Provider through HubUnit.
  const module = await import("../plugins/multilang-highlighter.js");
  const installed = module.install(core);
  if (installed.ok) await core.rememberReviewedPlugin(plugin.id,true);
  return installed;
}

/**
 * Restore only pre-reviewed, shipped code. Imported user source stays inert
 * until the untrusted sandbox and per-call ACL are fully validated.
 */
export async function restoreReviewedPlugins(core) {
  const saved = await core.listReviewedPlugins();
  if (!saved.ok) return saved;
  let restored = 0;
  let enabledRestored = 0;
  for (const entry of saved.value) {
    if (entry.providerId !== "cluster.sample.multilang-highlighter") continue;
    try {
      const module = await import("../plugins/multilang-highlighter.js");
      const result = module.install(core);
      if (!result.ok) continue;
      const manifest = core.uru.getProvider(entry.providerId);
      if (!manifest) continue;
      const enabled = core.setProviderEnabled(
        manifest.objectId,entry.providerId,entry.enabled);
      if (enabled.ok) {
        restored++;
        if (entry.enabled) enabledRestored++;
      }
    } catch {
      core.omu.record("EHU","ui","Plugin.ReviewedRestore",500,
        entry.providerId);
    }
  }
  return {ok:true,status:200,value:{restored,enabledRestored}};
}

export function renderResources(doc, host, options) {
  const {t, settings, apiEntries, logs, core, onPluginInstalled} = options;
  const layout = el(doc, "div", "pm-resources");
  const left = el(doc, "section", "pm-resource-pane pm-resource-tools");
  const right = el(doc, "section", "pm-resource-pane pm-resource-downloads");
  left.setAttribute("aria-label", t("資源工具", "Resource tools"));
  right.setAttribute("aria-label", t("可下載插件", "Downloadable plugins"));

  // Keep the already-connected budget controls and their handlers.
  left.append(el(doc, "h2", "pm-resource-heading",
    t("設定與工具", "Settings and tools")));
  left.append(settings);
  const exports = el(doc, "section", "pm-resource-exports");
  exports.append(el(doc, "h3", "", t("資料匯出", "Data exports")));
  const actions = el(doc, "div", "pm-resource-actions");
  actions.append(button(doc, t("下載 API 清單 JSON",
    "Download API list JSON"), () => downloadJSON(doc,
    "clusteropt2-api-list.json", {
      exportedAt: new Date().toISOString(),
      entries: apiEntries().map(({kind, id, owner, providerId, descriptor}) =>
        ({kind, id, owner, providerId, descriptor}))
    })));
  actions.append(button(doc, t("下載 EHU 日誌 JSON",
    "Download EHU log JSON"), () => downloadJSON(doc,
    "clusteropt2-ehu-log.json", {
      exportedAt: new Date().toISOString(),
      events: logs().filter(item => item.kind === "EHU").map(item => ({
        eventId: item.eventId, timestamp: item.timestamp,
        kind: item.kind, source: item.source, target: item.target,
        action: item.action, status: item.status
      }))
    })));
  // Portable multi-file plugin bundles are data, not permission grants.
  actions.append(button(doc, t("下載插件包", "Export plugin bundle"),
    async () => {
      const stored = await core.listStoredPluginBundles();
      const reviewed = await core.listReviewedPlugins();
      if (!stored.ok || !reviewed.ok) return;
      const selection=new Map(reviewed.value.filter(item=>
        PLUGINS.some(p=>p.kind!=="template"&&p.id===item.providerId)).map(item=>
        [item.providerId,item.enabled]));
      for(const provider of options.providers()) {
        if(!PLUGINS.some(item=>item.id===provider.providerId))continue;
        selection.set(provider.providerId,
          !core.uru.disabledProviders.has(provider.providerId));
      }
      downloadJSON(doc, "clusteropt2-plugin-bundle.json", {
        format: "cluster-plugin-collection", formatVersion: 1,
        packages: stored.value.map(item => item.snapshot),
        reviewed: [...selection].map(([providerId,enabled])=>
          ({providerId,enabled}))
      });
    }));
  const bundlePicker = el(doc, "input", "pm-native-picker");
  bundlePicker.type = "file";
  bundlePicker.accept = ".json,application/json";
  bundlePicker.setAttribute("aria-label", t("導入插件包",
    "Import plugin bundle"));
  const importStatus = el(doc, "p", "pm-muted");
  importStatus.setAttribute("role", "status");
  bundlePicker.addEventListener("change", async () => {
    const file = bundlePicker.files?.[0];
    bundlePicker.value = "";
    if (!file) return;
    if (file.size > 25165824) {
      importStatus.textContent = t("插件包過大。", "Bundle too large.");
      return;
    }
    try {
      const archive = JSON.parse(await file.text());
      if (archive?.format !== "cluster-plugin-collection" ||
          archive.formatVersion !== 1 ||
          !Array.isArray(archive.packages) ||
          archive.packages.length > 32) {
        throw Error("Invalid bundle");
      }
      const reviewed=archive.reviewed??[];
      if(!Array.isArray(reviewed) || reviewed.length>PLUGINS.length ||
         new Set(reviewed.map(entry=>entry?.providerId)).size!==
           reviewed.length ||
         reviewed.some(entry=>!entry ||
           Object.keys(entry).length!==2 ||
           typeof entry.enabled!=="boolean" ||
           !PLUGINS.some(p=>p.kind!=="template"&&p.id===entry.providerId))) {
        throw Error("Unrecognized reviewed plugin");
      }
      // Validate all packages before persisting any, avoiding partial
      // imports when one entry is invalid.
      for (const snapshot of archive.packages) {
        if (!core.inspectPluginBundle(snapshot).ok) {
          throw Error("Invalid package contents");
        }
      }
      let saved = 0;
      for (const snapshot of archive.packages) {
        const result = await core.savePluginBundle(snapshot);
        if (!result.ok) break;
        saved++;
      }
      let reviewedSaved=0;
      if(saved===archive.packages.length) {
        for(const entry of reviewed) {
          const result=await core.rememberReviewedPlugin(
            entry.providerId,entry.enabled);
          if(!result.ok)break;
          reviewedSaved++;
        }
        if(reviewedSaved===reviewed.length) {
          await restoreReviewedPlugins(core);
          options.onPluginInstalled?.();
        }
      }
      importStatus.textContent =
        saved===archive.packages.length &&
        reviewedSaved===reviewed.length ?
        t("插件包已匯入；已審核插件已恢復，自製插件保留待授權。",
          "Bundle imported: reviewed plugins restored; user code inactive.") :
        t("部分套件無法儲存，請檢查瀏覽器儲存權限。",
          "Some packages could not be stored.");
    } catch {
      importStatus.textContent = t("插件包格式錯誤，已拒絕導入。",
        "Invalid bundle; import rejected.");
    }
  });
  actions.append(button(doc, t("導入插件包", "Import plugin bundle"),
    () => bundlePicker.click()));
  exports.append(bundlePicker, importStatus);
  exports.append(actions);
  exports.append(el(doc, "p", "pm-muted", t(
    "匯出內容不包含敏感 Payload。",
    "Exports omit sensitive payloads.")));
  left.append(exports);

  const heading = el(doc, "div", "pm-market-header");
  const titles = el(doc, "div");
  titles.append(el(doc, "h2", "pm-resource-heading",
    t("可下載插件", "Downloadable plugins")));
  titles.append(el(doc, "p", "pm-muted", t(
    "先下載到本地；單檔插件直接裝載，ZIP 插件須解壓後選擇資料夾。",
    "Download first; mount single-file plugins directly or extract ZIP and select its folder.")));
  heading.append(titles);
  const search = el(doc, "input", "pm-resource-search");
  search.type = "search";
  search.id = "pluginResourceSearch";
  search.placeholder = t("搜尋可下載插件...",
    "Search downloadable plugins...");
  search.setAttribute("aria-label", t("搜尋可下載插件",
    "Search downloadable plugins"));
  const cards = el(doc, "div", "pm-resource-cards");
  const status = el(doc, "p", "pm-market-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  // User click opens the native file chooser without an async boundary.
  const filePicker = el(doc, "input", "pm-native-picker");
  filePicker.type = "file";
  filePicker.accept = ".js,text/javascript";
  filePicker.setAttribute("aria-label", t("選擇本地插件檔案",
    "Select a local plugin file"));
  let pendingPlugin = null;
  filePicker.addEventListener("change", async () => {
    const file = filePicker.files?.[0];
    if (!file || !pendingPlugin) return;
    const plugin = pendingPlugin;
    filePicker.value = "";
    status.textContent = t("正在驗證本地插件...",
      "Verifying selected local plugin...");
    try {
      const result = await mountReviewedFile(doc, plugin, file, core);
      if (result.ok) {
        status.textContent = result.alreadyInstalled ?
          t("插件已裝載。", "Plugin already mounted.") :
          t("插件已裝載並註冊到 HubUnit。",
            "Plugin mounted and registered with HubUnit.");
        onPluginInstalled?.();
      } else {
        status.textContent = result.status === 403 ?
          t("插件內容與可信下載版本不一致，已拒絕執行。",
            "Local file differs from the reviewed package; blocked.") :
          t("無法裝載所選插件（狀態 ",
            "Could not mount the selected plugin (status ") +
            result.status + ").";
      }
    } catch (error) {
      status.textContent = t("裝載失敗：", "Mount failed: ") +
        String(error);
    }
  });

  function renderCards() {
    cards.replaceChildren();
    const term = search.value.toLowerCase().trim();
    const matches = PLUGINS.filter(item =>
      [item.id, item.nameZh, item.nameEn,
        item.descriptionZh, item.descriptionEn,
        item.service, item.version].join(" ").toLowerCase()
        .includes(term));
    if (!matches.length) cards.append(el(doc, "p", "pm-muted", t(
      "沒有符合的可下載插件。", "No matching downloadable plugins.")));
    for (const plugin of matches) {
      const card = el(doc, "article", "pm-resource-card pm-market-card");
      const summary = el(doc, "div", "pm-market-summary");
      summary.append(el(doc, "strong", "", t(plugin.nameZh,
        plugin.nameEn)));
      summary.append(el(doc, "p", "pm-muted", t(
        plugin.descriptionZh, plugin.descriptionEn)));
      summary.append(el(doc, "small", "pm-market-meta",
        plugin.service + " · v" + plugin.version));
      const buttons = el(doc, "div", "pm-market-actions");
      if(plugin.kind==="folder-package") {
        const download = button(doc, t("下載 ZIP", "Download ZIP"),
          async () => {
            status.textContent = t("正在準備 AI Agent 插件包...",
              "Preparing AI Agent package...");
            download.disabled = true;
            try {
              await downloadAgentPackage(doc);
              status.textContent = t("下載已啟動。解壓 ZIP 後選擇資料夾裝載。",
                "Download started. Extract ZIP and select the folder to mount.");
            } catch {
              status.textContent = t("插件包下載失敗，請檢查檔案是否完整。",
                "Package download failed; check published assets.");
            } finally {
              download.disabled = false;
            }
          });
        download.id = "pluginAgentDownload";
        download.classList.add("pm-market-download");
        const mount = button(doc, t("裝載資料夾", "Mount folder"),
          event => installLocalFolder(event));
        mount.id = "pluginAgentMount";
        // Separate Windows CMD entrypoints use the same reviewed,
        // no-store deployment assets as the ZIP package.
        const agentCmd = button(doc, t(
          "下載 Agent CMD", "Download Agent CMD"), async () => {
          agentCmd.disabled = true;
          try {
            await downloadAgentQuickSetup(doc);
            status.textContent = t(
              "已開始下載 Agent CMD；執行時可確認既有連線紀錄。",
              "Agent CMD download started; existing setup is reviewed.");
          } catch {
            status.textContent = t(
              "Agent CMD 下載失敗，請重新整理後再試。",
              "Agent CMD download failed; refresh and retry.");
          } finally {
            agentCmd.disabled = false;
          }
        });
        agentCmd.id = "pluginAgentQuickSetupDownload";
        const mcpCmd = button(doc, t(
          "下載 MCP/OAuth CMD", "Download MCP/OAuth CMD"), async () => {
          mcpCmd.disabled = true;
          try {
            await downloadMCPQuickSetup(doc);
            status.textContent = t(
              "已開始下載 MCP/OAuth CMD；舊 URL 可選擇沿用或註銷。",
              "MCP/OAuth CMD download started; reuse or revoke old URL.");
          } catch {
            status.textContent = t(
              "MCP/OAuth CMD 下載失敗，請重新整理後再試。",
              "MCP/OAuth CMD download failed; refresh and retry.");
          } finally {
            mcpCmd.disabled = false;
          }
        });
        mcpCmd.id = "pluginMCPQuickSetupDownload";
        buttons.append(download, agentCmd, mcpCmd, mount);
      } else if(plugin.kind==="template") {
        const download=button(doc,t("下載 ZIP","Download ZIP"),()=>{
          const language=core.edpmu.get("Language");
          downloadPluginTemplate(doc,language==="en"?"en":"zh-Hant");
        });
        download.id="pluginTemplateDownload";
        download.classList.add("pm-market-download");
        buttons.append(download);
      } else {
        const download=el(doc,"a","pm-mini pm-market-download",
          t("下載","Download"));
        download.href=plugin.url;
        download.download=plugin.file;
        const mount=button(doc,t("裝載","Mount"),()=>{
          pendingPlugin=plugin;
          filePicker.click();
        });
        mount.setAttribute("aria-label",t("從本地檔案裝載 ",
          "Mount local file for ")+t(plugin.nameZh,plugin.nameEn));
        buttons.append(download,mount);
      }
      card.append(summary, buttons);
      cards.append(card);
    }
  }
  search.addEventListener("input", renderCards);
  renderCards();
  // PR13.2–13.4: explicit folder gesture, bounded data intake,
  // separate consent, then HubUnit/URU-backed sandbox installation.
  async function installLocalFolder(event) {
    // Native click events are trusted; plugin code in an opaque sandbox
    // cannot synthesize a valid host activation gesture.
    if (event && event.isTrusted === false) return;
    status.textContent = t("正在讀取所選插件包...",
      "Reading selected plugin package...");
    const result = await core.localPluginPackage.selectAndStage();
    if (!result.ok || !result.value.snapshot) {
      status.textContent = result.ok ?
        t("無法讀取完整資料夾，未執行插件。",
          "Complete folder access unavailable; plugin not executed.") :
        t("插件包驗證失敗（狀態 ",
          "Package validation failed (status ") + result.status + ").";
      return;
    }
    const snapshot = result.value.snapshot;
    const saved = await core.savePluginBundle(snapshot);
    if (!saved.ok) {
      status.textContent = t("插件包未能保存，未進行安裝。",
        "Package persistence failed; installation aborted.");
      return;
    }
    const provider = result.value.manifest.provider;
    const rpcScopes = result.value.manifest.rpcScopes ?? [];
    const summary = t(
      "確認執行自製插件？\\nProvider: ",
      "Run this user-authored plugin?\\nProvider: ") +
      provider.providerId + "\\n" +
      t("要求權限：", "Requested permissions: ") +
      (provider.permissions.join(", ") ||
        t("無", "None")) + "\\n" +
      t("要求 RPC 路由：", "Requested RPC scopes: ") + "\\n" +
      describePluginRPCScopes(rpcScopes, t) + "\\n" +
      t("插件無法直接存取主頁或 DOM，只能使用核准的 RPC 路由。",
        "No direct page/DOM access; only approved RPC routes are available.");
    const consented = doc.defaultView.confirm(summary);
    if (!consented) {
      status.textContent = t("套件已保存為待審核，未執行。",
        "Package stored as pending review; not executed.");
      return;
    }
    status.textContent = t("正在啟動隔離插件...",
      "Starting isolated plugin...");
    const installed = await core.pluginHostInstaller.install(snapshot,{
      consented: true,
      approvedPermissions: [...provider.permissions],
      approvedRpcScopes: rpcScopes
    });
    status.textContent = installed.ok ?
      t("插件已透過 HubUnit／URU 註冊並在隔離環境啟動。",
        "Plugin registered via HubUnit/URU in isolated sandbox.") :
      t("安全裝載失敗（狀態 ", "Safe activation failed (status ") +
      installed.status + ").";
    if (installed.ok) onPluginInstalled?.();
  }
  const localPackage = button(doc, t("選擇並裝載自製插件資料夾",
    "Select and install custom plugin folder"), installLocalFolder);
  localPackage.setAttribute("aria-label", t(
    "選擇資料夾、審核權限並裝載自製插件",
    "Choose folder, approve capabilities, install custom plugin"));
  const localGroup = el(doc, "section", "pm-resource-local");
  localGroup.append(localPackage);
  heading.append(search);
  right.append(heading, localGroup, cards, status, filePicker);
  layout.append(left, right);
  host.append(layout);
}
