import { Language } from "../property/Language.js";
import { PluginPermissionPolicy } from
  "../property/PluginPermissionPolicy.js";

const VIEWS=Object.freeze(["permissions","api","ehu","performance"]);
function dom(doc,tag,cls="",value) {
  const el=doc.createElement(tag);
  if(cls) el.className=cls;
  if(value!==undefined) el.textContent=String(value);
  return el;
}
function btn(doc,label,action,cls="",disabled=false) {
  const el=dom(doc,"button",cls,label);
  el.type="button";
  el.disabled=disabled;
  el.addEventListener("click",action);
  return el;
}
function tabular(doc,header,rows) {
  const el=dom(doc,"table","pm-table");
  if(header.length) {
    const h=dom(doc,"thead"),r=dom(doc,"tr");
    header.forEach(x=>r.append(dom(doc,"th","",x)));
    h.append(r);el.append(h);
  }
  const b=dom(doc,"tbody");
  rows.forEach(items=>{
    const r=dom(doc,"tr");
    items.forEach(x=>r.append(dom(doc,"td","",x??"—")));
    b.append(r);
  });
  el.append(b);return el;
}

/** Layout is reference-driven; live data has a single URU/OMU authority. */
export function mountPluginManagerUI(core,doc) {
  const root=doc.getElementById("pluginManagerPages");
  const oldSettings=doc.getElementById("pluginLegacySettings");
  const legacyMenu=doc.getElementById("pluginLegacyMenu");
  const tool=doc.getElementById("pluginToolToggle");
  if(!root||!oldSettings||!tool||!legacyMenu)
    throw Error("Missing Plugin Manager DOM");
  const shell=dom(doc,"div","pm-shell");
  const sidebar=dom(doc,"aside","pm-sidebar");
  const main=dom(doc,"main","pm-main");
  const nav=dom(doc,"div","pm-tabs");
  nav.setAttribute("role","tablist");
  const page=dom(doc,"section","pm-page");
  const search=dom(doc,"input","pm-search");
  const filter=dom(doc,"select","pm-filter");
  const items=dom(doc,"div","pm-list");
  const toolbar=dom(doc,"div","pm-search-row");
  let selected="",active="permissions",query="",mode="all",pending=null;
  let selectedAPI=null;
  search.type="search"; search.id="pluginManagerSearch";
  search.placeholder="Search plugin...";
  filter.id="pluginManagerFilter";
  filter.setAttribute("aria-label","Plugin filter");
  toolbar.append(search,filter);
  const sideHeading=dom(doc,"header","pm-side-heading");
  sidebar.append(sideHeading,toolbar,items);
  main.append(nav,page);shell.append(sidebar,main);
  root.replaceChildren(shell);

  // Migrate existing configured controls and event listeners unchanged.
  const migrated=dom(doc,"div","pm-migrated-settings");
  migrated.append(oldSettings);
  page.append(migrated);
  const modal=dom(doc,"dialog","plugin-consent-dialog");
  const heading=dom(doc,"h3");
  heading.id="pluginConsentTitle";
  modal.setAttribute("aria-labelledby","pluginConsentTitle");
  const explanation=dom(doc,"p");
  const footer=dom(doc,"div","plugin-manager-actions");
  const reject=btn(doc,"拒絕",()=>closeModal());
  const approve=btn(doc,"同意此權限",event=>{
    if(!event.isTrusted||!pending) return;
    const {p,permission}=pending;
    if(core.uru.getProvider(p.providerId)!==p ||
       !p.permissions.includes(permission)) return closeModal();
    const result=core.grantPluginPermission(p.objectId,
      p.providerId,permission,true);
    closeModal();if(result.ok) render();
  });
  footer.append(reject,approve);
  modal.append(heading,explanation,footer);
  doc.getElementById("pluginWindow").append(modal);
  modal.addEventListener("close",()=>{pending=null;});
  function closeModal() {
    pending=null;
    if(modal.open) modal.close();
    approve.hidden=false;
  }
  function ask(p,permission) {
    if(modal.open || PluginPermissionPolicy.level(permission)==="core")
      return;
    pending={p,permission};
    heading.textContent=t("確認插件授權","Confirm Plugin Permission");
    explanation.textContent=p.providerId+" · "+permission+
      " · 本次工作階段有效";
    approve.hidden=false;modal.showModal();
  }
  const locale=()=> {
    const code=core.edpmu.get("Language");
    return Language.valid(code)?code:Language.defaultLocale;
  };
  const t=(zh,en)=>locale()==="en"?en:zh;
  const providers=()=>core.uru.listProviders();
  const disabled=p=>core.uru.disabledProviders.has(p.providerId);
  const current=()=>providers().find(x=>x.providerId===selected)||null;
  const logs=()=>core.getSnapshot().logs??[];
  const viewName=key=>({
    permissions:t("權限","Permission"),
    api:t("API 列表","API List"),
    ehu:t("EHU 日誌","EHU Log"),
    performance:t("效能","Performance")
  })[key];
  const card=(name,action)=> {
    const section=dom(doc,"section","pm-card");
    const h=dom(doc,"header","pm-card-heading");
    h.append(dom(doc,"strong","",name));
    if(action)h.append(action);
    section.append(h);return section;
  };
  function permissionCard(p) {
    const section=card(t("權限概要","Permission Summary"),
      btn(doc,"⚙ "+t("權限管理","Manage Permission"),
        ()=>activate("permissions"),"pm-mini"));
    const body=dom(doc,"div","pm-card-body");
    const grants=(p.permissions??[]).filter(name=>
      core.checkPluginPermission(p.providerId,name)).length;
    body.append(dom(doc,"p","pm-muted",
      t("已授權","Granted Permissions")+"  "+grants));
    if(!p.permissions?.length)
      body.append(dom(doc,"p","pm-muted",t("未申請權限","No permissions")));
    for(const permission of p.permissions??[]) {
      const granted=core.checkPluginPermission(p.providerId,permission);
      const row=dom(doc,"div","pm-permission-row");
      const label=dom(doc,"label","pm-permission-label");
      const check=dom(doc,"input");
      check.type="checkbox";check.checked=granted;check.disabled=true;
      label.append(check,dom(doc,"span","",permission));
      row.append(label,btn(doc,granted?t("撤銷","Revoke"):t("授予","Grant"),
        ()=>{
          if(!granted)return ask(p,permission);
          const result=core.revokePluginPermission(
            p.objectId,p.providerId,permission);
          if(result.ok)render();
        },"pm-mini",PluginPermissionPolicy.level(permission)==="core"));
      body.append(row);
    }
    section.append(body);return section;
  }
  function logCard(p) {
    const section=card("EHU Log（EHU 記錄 / 歷史）",
      btn(doc,t("查看全部","View All")+" ↗",()=>activate("ehu"),"pm-mini"));
    const events=logs().filter(x=>x.kind==="EHU").slice(-250).reverse();
    section.append(tabular(doc,
      [t("時間","Time"),t("等級","Level"),t("動作","Action")],
      events.map(x=>[
        x.timestamp,x.kind,x.action])));
    return section;
  }
  function renderSidebar() {
    search.placeholder=t("搜尋插件...","Search plugin...");
    filter.setAttribute("aria-label",t("篩選插件","Filter plugins"));
    reject.textContent=t("拒絕","Deny");
    approve.textContent=t("同意此權限","Allow permission");
    items.replaceChildren();filter.replaceChildren();
    const choices=[["all",t("全部","All")],
      ["enabled",t("啟用","Enabled")],
      ["disabled",t("停用","Disabled")]];
    for(const [value,label] of choices) {
      const option=dom(doc,"option","",label);
      option.value=value;filter.append(option);
    }
    filter.value=mode;
    for(const p of providers().filter(x=>
      (x.providerId.toLowerCase().includes(query.toLowerCase())||
       x.objectId.toLowerCase().includes(query.toLowerCase()))&&
      (mode==="all"||(mode==="disabled")===disabled(x)))) {
      const row=btn(doc,"",()=>{selected=p.providerId;render();},
        "pm-provider");
      row.setAttribute("aria-pressed",String(selected===p.providerId));
      const label=dom(doc,"span","pm-provider-label");
      label.append(dom(doc,"strong","",p.providerId),
        dom(doc,"small","",(p.provides?.[0]?.version??"—")+
          " · "+(disabled(p)?t("停用","Disabled"):
            t("啟用","Enabled"))));
      row.append(dom(doc,"span","pm-cube","◇"),label,
        dom(doc,"span",disabled(p)?"pm-dot off":"pm-dot","●"));
      items.append(row);
    }
    if(!items.childElementCount)
      items.append(dom(doc,"p","pm-muted",t("沒有插件","No plugins")));
  }

  /** Read-only discovery of the live HubUnit-connected registries. */
  function apiEntries() {
    const result=core.catalog.collect();
    if(!result.ok)return [];
    const entries=new Map();
    const add=(kind,id,owner,descriptor,providerId="")=>{
      const key=kind+"|"+owner+"|"+id;
      entries.set(key,{key,kind,id,owner,descriptor,providerId});
    };
    for(const item of result.value.apis) {
      const d=item.descriptor;
      if(d.visibility!=="Private")
        add("Request",d.id,item.owner,d);
    }
    for(const item of result.value.properties) {
      const d=item.descriptor;
      if(d.visibility!=="Private")
        add("Property",item.name,d.owners.join(", "),d);
    }
    // Provider Manifests appear immediately after authorized registration.
    for(const provider of providers()) {
      if(disabled(provider))continue;
      for(const item of provider.provides??[]) {
        add("Provider",item.service,provider.objectId,{
          apiVersion:1,id:item.service,owner:provider.objectId,
          action:item.action,version:item.version,visibility:"Public",
          inputSchema:item.inputSchema,outputSchema:item.outputSchema
        },provider.providerId);
      }
    }
    // Legacy properties have metadata but no schema. Never invent one.
    for(const item of core.edpmu.list()) {
      if(item.visibility==="Private")continue;
      const key="Property|"+item.owners.join(", ")+"|"+item.name;
      if(!entries.has(key)) {
        add("Property",item.name,item.owners.join(", "),{
          name:item.name,owners:item.owners,visibility:item.visibility,
          note:"No registered schema descriptor"
        });
      }
    }
    return [...entries.values()].sort((a,b)=>
      a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  }
  function renderAPIs() {
    const entries=apiEntries();
    const section=card(t("HubUnit API 與屬性註冊表",
      "HubUnit API & Property Registry"));
    const note=dom(doc,"p","pm-muted",
      t("已註冊契約的唯讀檢視；API 執行仍受 HubUnit 權限控制。",
        "Read-only contracts. HubUnit still enforces execution permissions."));
    section.append(note);
    if(selectedAPI) {
      const entry=entries.find(x=>x.key===selectedAPI);
      if(entry) {
        section.append(btn(doc,"← "+t("返回清單","Back to list"),
          ()=>{selectedAPI=null;render();},"pm-mini"));
        const table=tabular(doc,[],[
          [t("種類","Type"),entry.kind],
          [t("名稱","Name"),entry.id],
          [t("所屬物件","Owner"),entry.owner],
          [t("提供者","Provider"),entry.providerId||"—"],
          [t("動作","Action"),entry.descriptor.action??"—"],
          [t("版本","Version"),entry.descriptor.version??"—"],
          [t("可見性","Visibility"),entry.descriptor.visibility??"—"]
        ]);
        section.append(table);
        section.append(dom(doc,"h3","pm-contract-title",
          t("詳細契約結構","Detailed contract structure")));
        const pre=dom(doc,"pre","pm-contract-json",
          JSON.stringify(entry.descriptor,null,2));
        pre.tabIndex=0;section.append(pre);
        page.append(section);return;
      }
      selectedAPI=null;
    }
    const list=dom(doc,"div","pm-api-list");
    for(const entry of entries) {
      const label=entry.kind+" · "+entry.id+" · "+entry.owner;
      const button=btn(doc,label,()=>{
        selectedAPI=entry.key;render();
      },"pm-api-entry");
      list.append(button);
    }
    if(!entries.length)list.append(dom(doc,"p","pm-muted",
      t("目前沒有已註冊的契約","No registered contracts")));
    section.append(list);page.append(section);
  }

  function render() {
    const all=providers();
    if(selected&&!all.some(x=>x.providerId===selected))selected="";
    if(!selected&&all.length)selected=all[0].providerId;
    renderSidebar();
    sideHeading.textContent=t("插件清單","Plugin List");
    const p=current();
    nav.replaceChildren();
    for(const key of VIEWS) {
      const item=btn(doc,viewName(key),()=>activate(key),"pm-tab");
      item.setAttribute("role","tab");
      item.setAttribute("aria-selected",String(active===key));
      nav.append(item);
    }
    page.replaceChildren();
    page.append(migrated);
    migrated.hidden=active!=="performance";
    legacyMenu.hidden=active!=="performance";
    oldSettings.hidden=active!=="performance";
    if(active==="performance")return;
    if(active==="api")return renderAPIs();
    if(!p) {
      page.append(dom(doc,"p","pm-muted",
        t("請選擇插件","Select a plugin")));
      return;
    }
    if(active==="permissions")page.append(permissionCard(p));
    if(active==="ehu")page.append(logCard(p));
  }
  function activate(key) {
    if(!VIEWS.includes(key))return;
    active=key;selectedAPI=null;
    tool.setAttribute("aria-pressed",String(key==="performance"));
    root.hidden=false;render();
  }
  search.addEventListener("input",()=>{
    query=search.value;
    const caret=search.selectionStart;
    renderSidebar();
    search.focus();search.setSelectionRange(caret,caret);
  });
  filter.addEventListener("change",()=>{mode=filter.value;renderSidebar();});
  tool.addEventListener("click",()=>activate(active==="performance"?
    "overview":"performance"));
  activate("permissions");
  return Object.freeze({refresh:render,select:activate});
}
