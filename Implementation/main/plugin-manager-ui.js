import { Language } from "../property/Language.js";
import { PluginPermissionPolicy } from
  "../property/PluginPermissionPolicy.js";
import { renderContractDetail } from "./plugin-contract-view.js";
import { renderResources } from "./plugin-resource-view.js";
import { describePluginRPCScopes } from
  "./plugin-rpc-scope-review.js";

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
export function mountPluginManagerUI(core,doc,options={}) {
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
  let lastView="",lastLocale="",lastSelected="",lastProviders="";
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
      const managed=core.pluginHostInstaller.handles.has(p.providerId);
      const changed=managed ?
        (toggle.checked ? core.pluginHostInstaller.enable(p.providerId) :
          core.pluginHostInstaller.disable(p.providerId)) :
        core.setProviderEnabled(
          p.objectId,p.providerId,toggle.checked);
      if(!changed.ok && changed.status===409) {
        doc.defaultView.alert(t(
          "相依性衝突：請先停用依賴此服務的插件。",
          "Dependency conflict: disable dependent plugins first."));
      }
      if(changed.ok) {
        void core.listReviewedPlugins().then(saved=>{
          if(saved.ok && saved.value.some(entry=>
            entry.providerId===p.providerId)) {
            void core.rememberReviewedPlugin(
              p.providerId,toggle.checked);
          }
        });
      }
      render();
    });
    switchLabel.append(toggle,dom(doc,"span","",
      t("啟用插件","Enable plugin")));
    const remove=btn(doc,t("移除插件","Unregister plugin"),()=>{
      if(!doc.defaultView.confirm(t("確定移除插件：",
        "Unregister plugin: ")+p.providerId+"?"))return;
      if(core.uru.getProvider(p.providerId)!==p)return render();
      const result=core.pluginHostInstaller.handles.has(p.providerId) ?
        core.pluginHostInstaller.uninstall(p.providerId) :
        core.unregisterProvider(p.objectId,p.providerId);
      if(result.ok) {
        selected="";
        if (p.providerId === "cluster.ai-agent-mcp") {
          // An explicit removal is remembered as an opt-out.
          void core.rememberReviewedPlugin(p.providerId, false);
        } else {
          void core.forgetReviewedPlugin(p.providerId);
        }
        void core.removeStoredPluginBundle(p.providerId);
      } else if(result.status===409) {
        doc.defaultView.alert(t(
          "尚有插件依賴此服務，請先停用相依插件。",
          "Other plugins depend on this service. Disable them first."));
      }
      render();
    },"pm-mini");
    controls.append(switchLabel,remove);
    if(core.pluginHostInstaller.handles.has(p.providerId)) {
      const upgrade=btn(doc,t("更新插件","Update plugin"),
        async () => {
          const staged=await core.localPluginPackage.selectAndStage();
          if(!staged.ok || !staged.value?.snapshot) {
            doc.defaultView.alert(t(
              "更新包驗證失敗，原插件不變。",
              "Update package rejected; existing plugin unchanged."));
            return;
          }
          const next=staged.value.manifest.provider;
          const permissions=next.permissions??[];
          const rpcScopes=staged.value.manifest.rpcScopes??[];
          const approved=doc.defaultView.confirm(t(
            "確認更新插件：","Update plugin: ")+p.providerId+
            "\n"+t("要求權限：","Requested permissions: ")+
            (permissions.join(", ")||t("無","None"))+"\n"+
            t("要求 RPC 路由：","Requested RPC scopes: ")+"\n"+
            describePluginRPCScopes(rpcScopes,t));
          if(!approved) return;
          const result=await core.pluginHostInstaller.upgrade(
            p.providerId,staged.value.snapshot,{
              consented:true,approvedPermissions:[...permissions],
              approvedRpcScopes:rpcScopes
            });
          let stored={ok:false};
          if(result.ok) {
            stored=await core.savePluginBundle(staged.value.snapshot);
          }
          doc.defaultView.alert(result.ok ?
            (stored.ok ?
              t("插件已更新並保存。","Plugin updated and saved.") :
              t("插件已更新，但無法保存到本機。",
                "Plugin updated, but local persistence failed.")) :
            t("更新失敗（狀態 ","Update failed (status ")+
              result.status+").");
          if(result.ok) options.onPluginInstalled?.();
          render();
        },"pm-mini");
      controls.append(upgrade);
    }
    body.append(controls);
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
    const rpcScopes=core.pluginHostInstaller?.listRpcScopes?.(
      p.providerId)??[];
    if(rpcScopes.length) {
      body.append(dom(doc,"p","pm-muted",
        t("已核准 RPC 路由：","Approved RPC routes: ")+
        rpcScopes.length));
    }
    for(const scope of rpcScopes) {
      const routeName=scope.target+" / "+scope.action+
        (scope.property===undefined?"":" ["+scope.property+"]");
      const row=dom(doc,"div","pm-permission-row");
      row.append(dom(doc,"span","pm-permission-label",routeName),
        btn(doc,t("撤銷路由","Revoke route"),()=>{
          if(!doc.defaultView.confirm(
            t("撤銷 RPC 路由？","Revoke RPC route?")+
            "\\n"+routeName)) return;
          const result=core.pluginHostInstaller.revokeRpcScope(
            p.providerId,scope);
          if(result.ok)render();
          else doc.defaultView.alert(
            t("撤銷失敗（狀態 ","Revoke failed (status ")+
            result.status+").");
        },"pm-mini"));
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

  /**
   * HubUnit is the authorized read boundary for OCDA API and Property
   * descriptors. Provider service contracts are projected from live URU.
   * No cached registration, forged schema or independent registry.
   */
  function apiEntries() {
    const entries=new Map();
    const add=(kind,id,owner,descriptor,providerId="")=>{
      const key=kind+"|"+owner+"|"+id+"|"+
        (descriptor.action??"");
      entries.set(key,{key,kind,id,owner,descriptor,providerId});
    };
    const collect=(kind)=>{
      let offset=0;
      const collected=[];
      while(offset<4096) {
        const result=core.discover("ui","list",kind,{
          offset,limit:100
        },{origin:"user"});
        if(!result.ok)return collected;
        collected.push(...result.value.items);
        if(result.value.nextOffset===null)break;
        offset=result.value.nextOffset;
      }
      return collected;
    };
    for(const item of collect("api")) {
      const descriptor=item.descriptor;
      add("Request",descriptor.id,item.owner,descriptor);
    }
    for(const item of collect("property")) {
      const descriptor=item.descriptor;
      add("Property",item.name,descriptor.owners.join(", "),descriptor);
    }
    // HubUnit's actual core method signatures are a shared read-only
    // EDPMU Property, not inferred APIs or a parallel plugin registry.
    const protocol=core.readProperty("ui","HubProtocolPolicy");
    if(protocol.ok) {
      for(const item of protocol.value.descriptions) {
        add("Protocol",item.id,"HubUnit",{
          id:item.id,action:item.action,visibility:"Public",
          description:item.description,
          inputSchema:item.inputSchema,
          outputSchema:item.outputSchema
        });
      }
    }
    // Include legacy declared UserAPI actions without guessing their
    // payload types. A missing schema is explicitly "Not declared".
    let actionOffset=0;
    while(actionOffset<4096) {
      const result=core.listActionContracts("ui",{
        origin:"user",offset:actionOffset,limit:100
      });
      if(!result.ok)break;
      for(const action of result.value.items) {
        if(action.described)continue;
        add("Action",action.id,action.owner,{
          id:action.id,action:action.action,
          version:action.version,
          visibility:action.visibility??"UserAPI",
          inputSchema:action.inputSchema,
          outputSchema:action.outputSchema,
          description:action.described?
            t("已宣告輸入輸出契約","Declared request/response") :
            t("舊版 Action，未宣告輸入輸出結構",
              "Legacy action: input/output schema not declared")
        });
      }
      if(result.value.nextOffset===null)break;
      actionOffset=result.value.nextOffset;
    }
    let providerOffset=0;
    while(providerOffset<4096) {
      const result=core.listProviderContracts("ui",{
        origin:"user",offset:providerOffset,limit:100
      });
      if(!result.ok)break;
      for(const service of result.value.items) {
        add("Provider",service.service,service.owner,{
          id:service.service,owner:service.owner,
          action:service.action,version:service.version,
          visibility:"Public",inputSchema:service.inputSchema,
          outputSchema:service.outputSchema,
          permissions:service.permissions
        },service.providerId);
      }
      if(result.value.nextOffset===null)break;
      providerOffset=result.value.nextOffset;
    }
    return [...entries.values()].sort((a,b)=>
      a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id)||
      a.owner.localeCompare(b.owner));
  }

  function schemaSummary(schema) {
    if(!schema)return t("未宣告","Not declared");
    if(schema.type!=="object"||!schema.properties)
      return schema.type??t("未宣告","Not declared");
    const required=new Set(schema.required??[]);
    const fields=Object.entries(schema.properties).map(([name,value])=>
      name+(required.has(name)?"*":"")+":"+
      (value.type??"?"));
    return fields.length?fields.join(", "):"{}";
  }

  function renderAPIs() {
    const entries=apiEntries();
    const section=dom(doc,"section","pm-api-section");
    section.append(dom(doc,"h2","pm-resource-heading",
      t("HubUnit API 列表","HubUnit API List")));
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
    input.placeholder=t("搜尋 API／Owner／Request／Response...",
      "Search API / owner / request / response...");
    input.setAttribute("aria-label",t("搜尋 API 契約",
      "Search API contracts"));
    const container=dom(doc,"div","pm-api-table-wrap");
    const table=dom(doc,"table","pm-api-table");
    const head=dom(doc,"thead");
    const headings=dom(doc,"tr");
    for(const title of [
      t("種類","Kind"),"API / Action",t("所屬物件","Owner"),
      t("Request 輸入","Request input"),
      t("Response 輸出","Response output"),
      t("權限","Permission")
    ]) {
      headings.append(dom(doc,"th","",title));
    }
    head.append(headings);
    const rows=dom(doc,"tbody");
    table.append(head,rows);
    container.append(table);
    body.append(input,container);

    function update() {
      apiQuery=input.value;
      const terms=apiQuery.toLowerCase().trim().split(/\\s+/)
        .filter(Boolean);
      rows.replaceChildren();
      const matching=entries.filter(entry=>{
        const descriptor=entry.descriptor;
        const searchText=[
          entry.kind,entry.id,entry.owner,entry.providerId,
          descriptor.action,descriptor.version,
          descriptor.visibility,descriptor.description,
          schemaSummary(descriptor.inputSchema),
          schemaSummary(descriptor.outputSchema),
          ...(descriptor.permissions??[])
        ].filter(Boolean).join(" ").toLowerCase();
        return terms.every(term=>searchText.includes(term));
      });
      for(const entry of matching) {
        const descriptor=entry.descriptor;
        const row=dom(doc,"tr","pm-api-table-row");
        const values=[
          entry.kind,entry.id+(descriptor.action?
            " / "+descriptor.action:""),entry.owner,
          schemaSummary(descriptor.inputSchema),
          schemaSummary(descriptor.outputSchema),
          (descriptor.permissions??[]).join(", ")||
            descriptor.visibility||t("未宣告","Not declared")
        ];
        values.forEach((value,index)=>{
          const cell=dom(doc,"td",index===3||index===4?
            "pm-api-schema-cell":"",value);
          if(index===1) {
            const link=btn(doc,value,()=>{
              selectedAPI=entry.key;render();
            },"pm-api-row-link");
            cell.replaceChildren(link);
          }
          row.append(cell);
        });
        rows.append(row);
      }
      if(!matching.length) {
        const empty=dom(doc,"tr");
        const cell=dom(doc,"td","pm-muted",
          t("沒有符合的 API 契約","No matching API contracts"));
        cell.colSpan=6;
        empty.append(cell);
        rows.append(empty);
      }
    }
    input.addEventListener("input",update);
    update();
    page.append(section);
  }

  function render(force=true) {
    const all=providers();
    if(selected&&!all.some(x=>x.providerId===selected))selected="";
    if(!selected&&all.length)selected=all[0].providerId;
    const language=locale();
    const providerState=all.map(p=>p.providerId+":"+
      (disabled(p)?"off":"on")+":"+
      p.provides.map(item=>item.version).join(",")).join("|");
    // Tool-tab refreshes are frequent. Never replace the active page
    // when its backing state is unchanged: scroll, focus, and caret
    // belong to the existing DOM instance.
    if(!force&&lastView===active&&lastLocale===language&&
        lastSelected===selected&&lastProviders===providerState) {
      return;
    }
    lastView=active;
    lastLocale=language;
    lastSelected=selected;
    lastProviders=providerState;
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
        t,settings:migrated,providers,disabled,apiEntries,logs,core,
        getActivePreview:options.getActivePreview,
        onPluginInstalled:options.onPluginInstalled
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
  return Object.freeze({refresh:()=>render(false),select:activate});
}
