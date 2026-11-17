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
  for (const entry of saved.value) {
    if (!PLUGINS.some(plugin=>plugin.id===entry.providerId)) continue;
    try {
      const module = await import("../plugins/multilang-highlighter.js");
      const result = module.install(core);
      if (!result.ok) continue;
      const manifest = core.uru.getProvider(entry.providerId);
      if (!manifest) continue;
      const enabled = core.setProviderEnabled(
        manifest.objectId,entry.providerId,entry.enabled);
      if (enabled.ok) restored++;
    } catch {
      core.omu.record("EHU","ui","Plugin.ReviewedRestore",500,
        entry.providerId);
    }
  }
  return {ok:true,status:200,value:{restored}};
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
        PLUGINS.some(p=>p.id===item.providerId)).map(item=>
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
           !PLUGINS.some(p=>p.id===entry.providerId))) {
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
    "先下載到本地，再點擊裝載並選擇檔案。",
    "Download locally, then select the file to mount.")));
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
      const download = el(doc, "a", "pm-mini pm-market-download",
        t("下載", "Download"));
      download.href = plugin.url;
      download.download = plugin.file;
      const mount = button(doc, t("裝載", "Mount"), () => {
        pendingPlugin = plugin;
        filePicker.click();
      });
      mount.setAttribute("aria-label", t("從本地檔案裝載 ",
        "Mount local file for ") + t(plugin.nameZh, plugin.nameEn));
      buttons.append(download, mount);
      card.append(summary, buttons);
      cards.append(card);
    }
  }
  search.addEventListener("input", renderCards);
  renderCards();
  // PR13.2: local user packages are staged only. Never describe them as
  // mounted or executable before sandbox and Hub authorization exist.
  const localPackage = button(doc, t("驗證本地自製插件包",
    "Validate local custom plugin package"), async () => {
    status.textContent = t("正在讀取所選插件包...",
      "Reading selected plugin package...");
    const result = await core.localPluginPackage.selectAndStage();
    if (result.ok && result.value.snapshot) {
      const saved = await core.savePluginBundle(result.value.snapshot);
      status.textContent = saved.ok ?
        t("整個插件資料夾已保存，重載後可恢復待審核套件；尚未執行。",
          "Full plugin folder saved for reload; execution is pending.") :
        t("套件驗證通過，但儲存失敗。",
          "Package validated, but storage failed.");
    } else {
      status.textContent = result.ok ?
        t("插件已驗證，但目前瀏覽器不支援完整資料夾保存。",
          "Plugin validated, but full folder storage is unavailable.") :
        t("插件包驗證失敗（狀態 ",
          "Package validation failed (status ") + result.status + ").";
    }
  });
  localPackage.setAttribute("aria-label", t(
    "選擇本地資料夾並驗證自製插件",
    "Select local folder and validate custom plugin"));
  const localGroup = el(doc, "section", "pm-resource-local");
  localGroup.append(localPackage);
  heading.append(search);
  right.append(heading, localGroup, cards, status, filePicker);
  layout.append(left, right);
  host.append(layout);
}
