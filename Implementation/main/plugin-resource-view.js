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
function providerStatus(provider,disabled,t) {
  return disabled(provider) ? t("停用","Disabled") :
    t("啟用","Enabled");
}
export function renderResources(doc,host,options) {
  const {t,settings,providers,disabled,apiEntries,logs,core,
    getActivePreview,onPluginInstalled}=options;
  const layout=el(doc,"div","pm-resources");
  const left=el(doc,"section","pm-resource-pane pm-resource-tools");
  const right=el(doc,"section","pm-resource-pane pm-resource-downloads");
  left.setAttribute("aria-label",t("資源工具","Resource tools"));
  right.setAttribute("aria-label",t("插件下載路徑","Plugin download locations"));

  left.append(el(doc,"h2","pm-resource-heading",
    t("設定與工具","Settings and tools")));
  // Re-parent existing controls, not clones: main.js listeners are retained.
  left.append(settings);
  const exports=el(doc,"section","pm-resource-exports");
  exports.append(el(doc,"h3","",t("資料匯出","Data exports")));
  const actions=el(doc,"div","pm-resource-actions");
  actions.append(button(doc,t("下載 API 清單 JSON","Download API list JSON"),
    ()=>downloadJSON(doc,"clusteropt2-api-list.json",{
      exportedAt:new Date().toISOString(),
      entries:apiEntries().map(({kind,id,owner,providerId,descriptor})=>({
        kind,id,owner,providerId,descriptor
      }))
    })));
  actions.append(button(doc,t("下載 EHU 日誌 JSON","Download EHU log JSON"),
    ()=>downloadJSON(doc,"clusteropt2-ehu-log.json",{
      exportedAt:new Date().toISOString(),
      events:logs().filter(item=>item.kind==="EHU").map(item=>({
        eventId:item.eventId,timestamp:item.timestamp,kind:item.kind,
        source:item.source,target:item.target,action:item.action,
        status:item.status
      }))
    })));
  exports.append(actions);
  exports.append(el(doc,"p","pm-muted",
    t("下載僅含可見的 API 契約與 EHU 基本事件欄位。",
      "Exports include visible contracts and basic EHU event fields only.")));
  left.append(exports);
  const sample=el(doc,"section","pm-resource-exports");
  sample.append(el(doc,"h3","",t("測試插件","Sample plugin")));
  sample.append(el(doc,"p","pm-muted",t(
    "多語言語法著色：JS/TS/Python/C/C++/Java/CSS/HTML/JSON/SQL。",
    "Multi-language syntax tokens: JS/TS/Python/C/C++/Java/CSS/HTML/JSON/SQL.")));
  const download=el(doc,"a","pm-mini",t(
    "下載多語言語法著色器 (.js)","Download syntax highlighter (.js)"));
  download.href="./Implementation/plugins/multilang-highlighter.js";
  download.download="multilang-highlighter.js";
  sample.append(download);
  const fileName=el(doc,"input","pm-resource-search");
  fileName.type="text";
  fileName.value="example.js";
  fileName.maxLength=160;
  fileName.setAttribute("aria-label",t("測試檔名","Sample filename"));
  sample.append(fileName);
  const sampleInput=el(doc,"textarea","pm-sample-editor",
    "const answer = 42; // sample");
  sampleInput.setAttribute("aria-label",t("語法測試文字","Syntax sample"));
  const sourceNote=el(doc,"p","pm-muted");
  if(typeof getActivePreview==="function") {
    sample.append(button(doc,t("讀取目前編輯頁面（唯讀）",
      "Load current editor page (read-only)"),()=>{
      const snapshot=getActivePreview();
      if(!snapshot) {
        sourceNote.textContent=t("沒有開啟的文件","No open document");
        return;
      }
      fileName.value=snapshot.fileName;
      sampleInput.value=snapshot.text;
      sourceNote.textContent=snapshot.truncated?t(
        "僅載入前 65,536 字元；不會修改原始文件。",
        "First 65,536 characters only; source is not modified.") :
        t("已複製目前頁面內容到測試區（未修改原始文件）。",
          "Copied current page for testing; source is unchanged.");
    }));
  }
  sample.append(sourceNote);
  const sampleResult=el(doc,"pre","pm-sample-preview");
  sampleResult.setAttribute("aria-live","polite");
  sampleInput.maxLength=65536;
  sample.append(sampleInput,button(doc,t("測試插件","Run plugin test"),
    async()=>{
      const response=await core.requestService("ui",
        "editor.syntax.highlight","highlight",{
          text:sampleInput.value,fileName:fileName.value
        },{origin:"user"});
      sampleResult.replaceChildren();
      if(!response.ok) {
        sampleResult.textContent="HTTP "+response.status;
        return;
      }
      const value=response.value;
      if(!Array.isArray(value?.tokens)) {
        sampleResult.textContent="Invalid plugin output";
        return;
      }
      const allowed=new Set([
        "plain","keyword","string","number","comment","operator"
      ]);
      for(const token of value.tokens) {
        if(typeof token?.text!=="string" ||
          !allowed.has(token.type)) {
          sampleResult.textContent=t(
            "插件回傳資料格式錯誤","Invalid plugin result");
          return;
        }
        sampleResult.append(el(doc,"span",
          "pm-token-"+token.type,token.text));
      }
    }),sampleResult);
  left.append(sample);

  right.append(el(doc,"h2","pm-resource-heading",
    t("插件下載資訊","Plugin download information")));
  const search=el(doc,"input","pm-resource-search");
  search.type="search";
  search.id="pluginResourceSearch";
  search.setAttribute("aria-label",t("搜尋插件下載資訊",
    "Search plugin download information"));
  search.placeholder=t("搜尋插件名稱、服務或版本...",
    "Search plugin, service or version...");
  const cards=el(doc,"div","pm-resource-cards");
  const mount=el(doc,"section","pm-resource-card");
  mount.append(el(doc,"strong","",t("裝載插件路徑","Mount plugin path")));
  const path=el(doc,"input","pm-resource-search");
  path.type="text";
  path.value="./Implementation/plugins/multilang-highlighter.js";
  path.setAttribute("aria-label",t("插件程式路徑","Plugin source path"));
  const mountStatus=el(doc,"p","pm-muted");
  mount.append(path,button(doc,t("裝載","Mount"),async()=>{
    const value=path.value.trim();
    // No arbitrary dynamic import: trusted bundled sample only.
    if(value!=="./Implementation/plugins/multilang-highlighter.js") {
      mountStatus.textContent=t(
        "403：此版本僅允許裝載經審核的內建插件路徑。",
        "403: Only the reviewed bundled plugin path is supported.");
      return;
    }
    try {
      const module=await import("../plugins/multilang-highlighter.js");
      const result=module.install(core);
      if(result.ok) {
        renderCards();
        onPluginInstalled?.();
      }
      mountStatus.textContent=result.ok?t(
        result.alreadyInstalled ? "插件已註冊。" :
          "201：插件已裝載並向 HubUnit 註冊。",
        result.alreadyInstalled ? "Already mounted." :
          "201: Plugin mounted and registered with HubUnit.") :
        "HTTP "+result.status;
    } catch(error) {
      mountStatus.textContent="HTTP 500: "+String(error);
    }
  }),mountStatus);
  right.append(mount,search,cards);
  function renderCards() {
    cards.replaceChildren();
    const term=search.value.trim().toLowerCase();
    const matching=providers().filter(provider=>{
      const values=[
        provider.providerId,provider.objectId,
        ...provider.provides.map(item=>item.service+" "+item.version),
        disabled(provider)?"disabled 停用":"enabled 啟用"
      ];
      return values.join(" ").toLowerCase().includes(term);
    });
    if(!matching.length) {
      cards.append(el(doc,"p","pm-muted",t(
        "目前沒有符合搜尋的已註冊插件。",
        "No registered plugins match this search.")));
    }
    for(const provider of matching) {
      const card=el(doc,"article","pm-resource-card");
      card.append(el(doc,"strong","",provider.providerId));
      card.append(el(doc,"p","pm-muted",
        t("所屬物件","Owner")+": "+provider.objectId+" · "+
        providerStatus(provider,disabled,t)));
      card.append(el(doc,"p","pm-muted",
        t("提供服務","Services")+": "+
        provider.provides.map(item=>item.service+
          " (v"+item.version+")").join(", ")));
      const packaged=provider.providerId===
        "cluster.sample.multilang-highlighter";
      card.append(el(doc,"p",
        packaged?"pm-muted":"pm-resource-unavailable",
        packaged?"Implementation/plugins/multilang-highlighter.js":
          t("插件套件下載路徑：未註冊",
            "Plugin package download URL: not registered")));
      card.append(button(doc,t("下載 Manifest JSON",
        "Download Manifest JSON"),()=>downloadJSON(doc,
        "plugin-"+provider.providerId.replace(/[^a-zA-Z0-9._-]/g,"_")+
          "-manifest.json",provider)));
      cards.append(card);
    }
    const foot=el(doc,"p","pm-muted",
      t("HubUnit Manifest 不包含套件下載網址；若未提供可信來源，不顯示安裝按鈕。",
        "HubUnit Manifests have no package URL field. No install button is shown without a verified source."));
    cards.append(foot);
  }
  search.addEventListener("input",renderCards);
  renderCards();
  layout.append(left,right);
  host.append(layout);
}
