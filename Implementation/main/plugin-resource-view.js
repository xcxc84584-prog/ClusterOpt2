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
  const {t,settings,providers,disabled,apiEntries,logs}=options;
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
  right.append(search,cards);
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
      card.append(el(doc,"p","pm-resource-unavailable",
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
