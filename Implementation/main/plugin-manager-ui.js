import { Language } from "../property/Language.js";
import { PluginPermissionPolicy } from
  "../property/PluginPermissionPolicy.js";
import { renderContractDetail } from "./plugin-contract-view.js";
import { renderResources } from "./plugin-resource-view.js";

const VIEWS=Object.freeze(["permissions","api","ehu","resources"]);
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
  // Old index.html can coexist with a newer JS module after a Pages
  // deployment or browser cache refresh. Recover missing mount nodes.
  const windowNode=doc.getElementById("pluginWindow");
  if(!windowNode) {
    throw Error("Missing pluginWindow: refresh the page HTML");
  }
  let root=doc.getElementById("pluginManagerPages");
  let oldSettings=doc.getElementById("pluginLegacySettings");
  let workbench=windowNode.querySelector(".plugin-workbench-body");
  if(!workbench) {
    workbench=dom(doc,"div","plugin-workbench-body");
    windowNode.append(workbench);
  }
  if(!root) {
    root=dom(doc,"div");
    root.id="pluginManagerPages";
    workbench.prepend(root);
  }
  if(!oldSettings) {
    oldSettings=dom(doc,"div","plugin-dialog-content");
    oldSettings.id="pluginLegacySettings";
    oldSettings.hidden=true;
    const performance=dom(doc,"section");
    performance.id="pluginPerformanceOptions";
    performance.dataset.pluginPanel="performance";
    const controls=dom(doc,"div","pm-budget-inline");
    const label=dom(doc,"label","",
      "最大文本載入量（MiB）");
    label.id="pluginMaxLabel";
    label.htmlFor="pluginMaxMiB";
    const input=dom(doc,"input");
    input.id="pluginMaxMiB";
    input.type="number";
    input.min="1";input.max="1024";input.step="1";
    input.value="8";
    const apply=dom(doc,"button","","套用");
    apply.type="button";
    apply.id="pluginApply";
    const note=dom(doc,"p","",
      "此設定目前僅控制切片快取容量。");
    note.id="pluginLimitNote";
    note.setAttribute("role","status");
    note.setAttribute("aria-live","polite");
    controls.append(label,input,apply);
    performance.append(controls,note);
    oldSettings.append(performance);
    workbench.append(oldSettings);
  }
  const shell=dom(doc,"div","pm-shell");
  const sidebar=dom(doc,"aside","pm-sidebar");
  const main=dom(doc,"main","pm-main");
  const nav=dom(doc,"div","pm-tabs");
  nav.setAttribute("role","tablist");
  const page=dom(doc,"section","pm-page");
  const search=dom(doc,"input","pm-search");
  const items=dom(doc,"div","pm-list");
  const toolbar=dom(doc,"div","pm-search-row");
  let selected="",active="permissions",query="",pending=null;
  let selectedAPI=null,apiQuery="",sidebarOpen=true;
  search.type="search"; search.id="pluginManagerSearch";
  search.placeholder="Search plugin...";
  toolbar.append(search);
  const sideHeading=dom(doc,"header","pm-side-heading");
  const sidebarToggle=btn(doc,"☰",()=>{
    sidebarOpen=!sidebarOpen;
    renderSidebar();
  },"pm-sidebar-toggle");
  sidebarToggle.id="pluginSidebarToggle";
  sideHeading.append(sidebarToggle,dom(doc,"span","pm-side-title"));
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
  windowNode.append(modal);
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
    resources:t("資源","Resources")
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
    const controls=dom(doc,"div","pm-permission-controls");
    const switchLabel=dom(doc,"label","pm-permission-label");
    const toggle=dom(doc,"input");
    toggle.type="checkbox";toggle.checked=!disabled(p);
    toggle.setAttribute("aria-label",t("啟用插件","Enable plugin"));
    toggle.addEventListener("change",()=>{
      if(core.uru.getProvider(p.providerId)!==p)return render();
      core.setProviderEnabled(p.objectId,p.providerId,toggle.checked);
      render();
    });
    switchLabel.append(toggle,dom(doc,"span","",
      t("啟用插件","Enable plugin")));
    const remove=btn(doc,t("移除插件","Unregister plugin"),()=>{
      if(!doc.defaultView.confirm(t("確定移除插件：",
        "Unregister plugin: ")+p.providerId+"?"))return;
      if(core.uru.getProvider(p.providerId)!==p)return render();
      const result=core.unregisterProvider(p.objectId,p.providerId);
      if(result.ok)selected="";
      render();
    },"pm-mini");
    controls.append(switchLabel,remove);body.append(controls);
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
    const expanded=sidebarOpen;
    sidebar.classList.toggle("pm-sidebar-collapsed",!expanded);
    sidebarToggle.setAttribute("aria-expanded",String(expanded));
    sidebarToggle.setAttribute("aria-label",expanded?
      t("收合插件清單","Collapse plugin list"):
      t("展開插件清單","Expand plugin list"));
    sidebarToggle.title=expanded?
      t("收合插件清單","Collapse plugin list"):
      t("展開插件清單","Expand plugin list");
    search.placeholder=t("搜尋插件或 Enabled/Disabled...",
      "Search plugin or Enabled/Disabled...");
    search.setAttribute("aria-label",t("搜尋插件","Search plugins"));
    toolbar.hidden=!expanded;items.hidden=!expanded;
    reject.textContent=t("拒絕","Deny");
    approve.textContent=t("同意此權限","Allow permission");
    if(!expanded)return;
    items.replaceChildren();
    const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches=provider=>{
      const enabled=!disabled(provider);
      const tags=[
        provider.providerId,provider.objectId,
        ...provider.provides.map(x=>x.service+" "+x.action+
          " "+x.version),
        ...(provider.permissions??[]),
        enabled?"enabled 啟用 active":"disabled 停用 inactive"
      ].join(" ").toLowerCase();
      return terms.every(term=>tags.includes(term));
    };
    for(const p of providers().filter(matches)) {
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
    if(!items.childElementCount)items.append(dom(doc,"p",
      "pm-muted",t("沒有符合的插件","No matching plugins")));
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
    const section=card(t("HubUnit API 契約","HubUnit API Contracts"));
    const body=dom(doc,"div","pm-api-browser");
    section.append(body);
    if(selectedAPI) {
      const selectedEntry=entries.find(x=>x.key===selectedAPI);
      if(selectedEntry) {
        renderContractDetail(doc,body,selectedEntry,t,()=>{
          selectedAPI=null;render();
        });
        page.append(section);
        return;
      }
      selectedAPI=null;
    }
    const input=dom(doc,"input","pm-api-search");
    input.type="search";
    input.id="pluginApiSearch";
    input.value=apiQuery;
    input.placeholder=t("搜尋 API、Owner、Action、版本...",
      "Search API, owner, action, version...");
    input.setAttribute("aria-label",t("搜尋 API 契約",
      "Search API contracts"));
    const list=dom(doc,"div","pm-api-list");
    body.append(input,list);
    function update() {
      apiQuery=input.value;
      const terms=apiQuery.toLowerCase().trim().split(/\s+/)
        .filter(Boolean);
      list.replaceChildren();
      const matching=entries.filter(x=>{
        const text=[x.kind,x.id,x.owner,x.providerId,
          x.descriptor.action,x.descriptor.version,
          x.descriptor.visibility,x.descriptor.description]
          .filter(Boolean).join(" ").toLowerCase();
        return terms.every(term=>text.includes(term));
      });
      for(const entry of matching) {
        const label=entry.kind+" · "+entry.id+" · "+entry.owner+
          (entry.descriptor.version?
            " · v"+entry.descriptor.version:"");
        const button=btn(doc,label,()=>{
          selectedAPI=entry.key;render();
        },"pm-api-entry");
        list.append(button);
      }
      if(!matching.length)list.append(dom(doc,"p","pm-muted",
        t("沒有符合的 API 契約","No matching API contracts")));
    }
    input.addEventListener("input",update);
    update();
    page.append(section);
  }

  function render() {
    const all=providers();
    if(selected&&!all.some(x=>x.providerId===selected))selected="";
    if(!selected&&all.length)selected=all[0].providerId;
    renderSidebar();
    sideHeading.querySelector(".pm-side-title").textContent=
      t("插件清單","Plugin List");
    windowNode.setAttribute("aria-label",
      t("插件管理","Plugin Manager"));
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
    migrated.hidden=active!=="resources";
    oldSettings.hidden=active!=="resources";
    if(active==="resources") {
      renderResources(doc,page,{
        t,settings:migrated,providers,disabled,apiEntries,logs
      });
      return;
    }
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
    root.hidden=false;render();
  }
  search.addEventListener("input",()=>{
    query=search.value;
    const caret=search.selectionStart;
    renderSidebar();
    search.focus();search.setSelectionRange(caret,caret);
  });
  activate("permissions");
  return Object.freeze({refresh:render,select:activate});
}
