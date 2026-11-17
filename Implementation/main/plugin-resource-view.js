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
  return module.install(core);
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
  heading.append(search);
  right.append(heading, cards, status, filePicker);
  layout.append(left, right);
  host.append(layout);
}
