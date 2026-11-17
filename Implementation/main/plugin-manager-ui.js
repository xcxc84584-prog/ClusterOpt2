import { Language } from "../property/Language.js";
import { PluginPermissionPolicy } from
  "../property/PluginPermissionPolicy.js";

const VIEWS = Object.freeze([
  ["overview","Overview（總覽）"],
  ["list","Plugin List（插件列表）"],
  ["permissions","Plugin Permission（權限）"],
  ["api","API List（API）"],
  ["ehu","EHU Log（EHU 日誌）"],
  ["performance","效能化（Performance）"]
]);
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
  const top=dom(doc,"section","pm-hero");
  const nav=dom(doc,"div","pm-tabs");
  nav.setAttribute("role","tablist");
  const page=dom(doc,"section","pm-page");
  const search=dom(doc,"input","pm-search");
  const filter=dom(doc,"select","pm-filter");
  const items=dom(doc,"div","pm-list");
  const toolbar=dom(doc,"div","pm-search-row");
  let selected="",active="overview",query="",mode="all",pending=null;
  search.type="search"; search.id="pluginManagerSearch";
  search.placeholder="Search plugin...";
  filter.id="pluginManagerFilter";
  filter.setAttribute("aria-label","Plugin filter");
  toolbar.append(search,filter);
  const install=btn(doc,"＋ Install Plugin（安裝插件）",()=>{
    info("External plugin installation is not available.");
  },"pm-install");
  sidebar.append(dom(doc,"header","pm-side-heading",
    "插件列表  Plugin List"),toolbar,items,install);
  main.append(top,nav,page);shell.append(sidebar,main);
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
  function info(text) {
    if(modal.open) return;
    heading.textContent="Plugin Manager";
    explanation.textContent=text;
    approve.hidden=true;modal.showModal();
  }
  function ask(p,permission) {
    if(modal.open || PluginPermissionPolicy.level(permission)==="core")
      return;
    pending={p,permission};
    heading.textContent="確認插件授權 / Confirm Permission";
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
  function apiCard(p) {
    const section=card("API Capability List（API 能力列表）");
    section.append(tabular(doc,["API ID","API Name","Description"],
      (p.provides??[]).map((x,i)=>[
        "API-"+String(i+1).padStart(3,"0"),x.action,x.service])));
    return section;
  }
  function logCard(p) {
    const section=card("EHU Log（EHU 記錄 / 歷史）",
      btn(doc,t("查看全部","View All")+" ↗",()=>activate("ehu"),"pm-mini"));
    const events=logs().filter(x=>!p||
      x.source===p.objectId||x.target===p.providerId||
      x.source===p.providerId).slice(-70).reverse();
    section.append(tabular(doc,["Time（時間）","Level","Message（訊息）"],
      (active==="overview"?events.slice(0,5):events).map(x=>[
        x.timestamp,x.kind,x.action])));
    return section;
  }
  function overview(p) {
    const grid=dom(doc,"div","pm-grid");
    const info=card("Basic Information（基本資訊）");
    info.append(tabular(doc,[],[
      ["Plugin Name",p.providerId],
      ["Version",p.provides?.[0]?.version],
      ["Status",disabled(p)?"Disabled":"Enabled"],
      ["Description",(p.provides??[]).map(x=>x.service).join(", ")],
      ["Provider",p.providerId],["Owner Object",p.objectId]
    ]));
    grid.append(info,permissionCard(p),apiCard(p),logCard(p));
    page.append(grid);
  }
  function sidebar() {
    search.placeholder=t("搜尋插件...","Search plugin...");
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
          " · "+(disabled(p)?"Disabled":"Enabled")));
      row.append(dom(doc,"span","pm-cube","◇"),label,
        dom(doc,"span",disabled(p)?"pm-dot off":"pm-dot","●"));
      items.append(row);
    }
    if(!items.childElementCount)
      items.append(dom(doc,"p","pm-muted",t("沒有插件","No plugins")));
  }
  function hero(p) {
    top.replaceChildren();
    if(!p) {
      top.append(dom(doc,"p","pm-muted",
        t("選擇左側插件查看資訊","Select a plugin from the list")));
      return;
    }
    const info=dom(doc,"div","pm-hero-info");
    info.append(dom(doc,"h2","",p.providerId),
      dom(doc,"p","",p.objectId+" / HubUnit"),
      dom(doc,"p","pm-muted","Version: "+
        (p.provides?.[0]?.version??"—")+"  |  Status: "+
        (disabled(p)?"Disabled":"Enabled")));
    const actions=dom(doc,"div","pm-hero-actions");
    const switcher=dom(doc,"label","pm-switch");
    const check=dom(doc,"input");
    check.type="checkbox";check.checked=!disabled(p);
    check.setAttribute("aria-label","Enable / Disable");
    check.addEventListener("change",()=>{
      if(core.uru.getProvider(p.providerId)!==p)return render();
      const result=core.setProviderEnabled(
        p.objectId,p.providerId,check.checked);
      if(!result.ok)check.checked=!check.checked;
      render();
    });
    switcher.append(dom(doc,"span","","Enable / Disable"),check);
    const buttons=dom(doc,"div","pm-action-buttons");
    buttons.append(btn(doc,"↻ Update（更新）",()=>
      infoMessage("Verified update pipeline is unavailable."),"pm-button"),
      btn(doc,"▤ Uninstall（移除）",()=>{
        if(!doc.defaultView.confirm("Unregister "+p.providerId+"?"))
          return;
        if(core.uru.getProvider(p.providerId)!==p)return render();
        const removed=core.unregisterProvider(p.objectId,p.providerId);
        if(removed.ok)selected="";
        render();
      },"pm-button"));
    actions.append(switcher,buttons);
    top.append(dom(doc,"span","pm-hero-cube","◇"),info,actions);
  }
  const infoMessage=info;
  function render() {
    const all=providers();
    if(selected&&!all.some(x=>x.providerId===selected))selected="";
    if(!selected&&all.length)selected=all[0].providerId;
    sidebar();
    const p=current();
    hero(p);
    nav.replaceChildren();
    for(const [key,label] of VIEWS) {
      const item=btn(doc,label,()=>activate(key),"pm-tab");
      item.setAttribute("role","tab");
      item.setAttribute("aria-selected",String(active===key));
      nav.append(item);
    }
    page.replaceChildren();
    // Keep settings connected: main.js resolves existing elements by ID.
    page.append(migrated);
    migrated.hidden=active!=="performance";
    legacyMenu.hidden=active!=="performance";
    oldSettings.hidden=active!=="performance";
    if(active==="performance")return;
    if(!p){page.append(dom(doc,"p","pm-muted",
      t("目前沒有註冊插件","No registered plugins")));return;}
    if(active==="overview")overview(p);
    if(active==="list") {
      const section=card("Plugin List（插件列表）");
      section.append(tabular(doc,["Provider","Owner","Version"],
        [[p.providerId,p.objectId,p.provides?.[0]?.version]]));
      page.append(section);
    }
    if(active==="permissions")page.append(permissionCard(p));
    if(active==="api")page.append(apiCard(p));
    if(active==="ehu")page.append(logCard(p));
  }
  function activate(key) {
    if(!VIEWS.some(x=>x[0]===key))return;
    active=key;
    tool.setAttribute("aria-pressed",String(key==="performance"));
    root.hidden=false;render();
  }
  search.addEventListener("input",()=>{
    query=search.value;
    const caret=search.selectionStart;
    sidebar();
    search.focus();search.setSelectionRange(caret,caret);
  });
  filter.addEventListener("change",()=>{mode=filter.value;sidebar();});
  tool.addEventListener("click",()=>activate(active==="performance"?
    "overview":"performance"));
  activate("overview");
  return Object.freeze({refresh:render,select:activate});
}
