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
  let apiKind="api",apiPageSize=25,apiPageIndex=0;
  let apiSort="owner",apiSortOrder="asc";
  let apiCursors=[null],apiRevision="",refreshAPIPage=null;
  let lastApiCheckTime=0;
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
    const circuit=core.pluginHostInstaller.getRPCCircuitState(
      p.providerId);
    if(circuit.open) {
      const row=dom(doc,"div","pm-permission-row");
      row.append(dom(doc,"span","pm-permission-label",
        t("RPC 熔斷：請先確認插件狀態。",
          "RPC circuit open: inspect plugin state first.")),
        btn(doc,t("重設熔斷","Reset circuit"),event=>{
          if(!event.isTrusted || !doc.defaultView.confirm(
            t("確認重設此插件的 RPC 熔斷？",
              "Reset this plugin's RPC circuit?")))return;
          const result=core.pluginHostInstaller.resetRPCCircuit(
            p.providerId,{consented:true});
          if(!result.ok)doc.defaultView.alert(
            t("重設失敗（狀態 ","Reset failed (status ")+
            result.status+").");
          render();
        },"pm-mini"));
      body.append(row);
    }
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
        btn(doc,t("撤銷路由","Revoke route"),async()=>{
          if(!doc.defaultView.confirm(
            t("撤銷 RPC 路由？","Revoke RPC route?")+
            "\\n"+routeName)) return;
          const result=await core.pluginHostInstaller
            .revokeRpcScopePersisted(p.providerId,scope);
          if(!result.ok)doc.defaultView.alert(
            result.status===503 ?
              t("撤權已在本次執行中生效，但無法永久保存。" +
                " 為安全起見，插件已停用。",
                "Revoked in memory, but persistence failed." +
                " Plugin disabled for safety.") :
              t("撤銷失敗（狀態 ","Revoke failed (status ")+
                result.status+").");
          render();
        },"pm-mini"));
      body.append(row);
    }
    // Denials are fetched from Host-private storage, never from the
    // plugin manifest or a Worker response.
    if(core.pluginHostInstaller.handles.has(p.providerId)) {
      const deniedPane=dom(doc,"div","pm-revoked-rpc");
      body.append(deniedPane);
      void core.pluginHostInstaller.listRevokedRpcScopes(
        p.providerId).then(saved=>{
        if(!deniedPane.isConnected ||
           current()?.providerId!==p.providerId) return;
        if(!saved.ok) {
          deniedPane.append(dom(doc,"p","pm-muted",
            t("無法查詢已撤權路由。","Cannot read revoked routes.")));
          return;
        }
        if(saved.value.length)deniedPane.append(dom(doc,"p","pm-muted",
          t("已撤權路由（重新授權需再次確認）：",
            "Revoked routes (explicit reapproval required):")));
        for(const scope of saved.value) {
          const routeName=scope.target+" / "+scope.action+
            (scope.property===undefined?"":" ["+scope.property+"]");
          const row=dom(doc,"div","pm-permission-row");
          row.append(dom(doc,"span","pm-permission-label",routeName),
            btn(doc,t("重新授權","Reapprove"),async event=>{
              if(!event.isTrusted)return;
              if(!doc.defaultView.confirm(t(
                "確認重新授權此 RPC 路由？","Reapprove this RPC route?")+
                "\n"+routeName))return;
              const result=await core.pluginHostInstaller.reapproveRpcScope(
                p.providerId,scope,{consented:true});
              if(!result.ok)doc.defaultView.alert(t(
                "無法重新授權（狀態 ","Cannot reapprove (status ")+
                result.status+").");
              render();
            },"pm-mini"));
          deniedPane.append(row);
        }
      }).catch(()=>{
        if(deniedPane.isConnected)deniedPane.append(
          dom(doc,"p","pm-muted",
            t("撤權紀錄不可用。","Revocation data unavailable.")));
      });
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
    const section=dom(doc,"section","pm-api-section");
    section.append(dom(doc,"h2","pm-resource-heading",
      t("HubUnit API 列表","HubUnit API List")));
    const body=dom(doc,"div","pm-api-browser");
    const controls=dom(doc,"div","pm-api-toolbar");
    const input=dom(doc,"input","pm-api-search");
    input.type="search";
    input.id="pluginApiSearch";
    input.value=apiQuery;
    input.placeholder=t("搜尋 API 契約","Search API contracts");
    input.setAttribute("aria-label",t("搜尋 API 契約",
      "Search API contracts"));
    const kind=dom(doc,"select","pm-api-kind");
    const kinds=[
      ["api","Object"],["service","Service"],
      ["property","Property"],["event","Event"],
      ["protocol","Protocol"]
    ];
    for(const [value,label] of kinds) {
      const option=dom(doc,"option","",label);
      option.value=value;
      kind.append(option);
    }
    kind.value=apiKind;
    kind.setAttribute("aria-label",t("API 分類","API category"));
    const size=dom(doc,"select","pm-api-size");
    for(const value of [10,25,50,100]) {
      const option=dom(doc,"option","",String(value));
      option.value=String(value);size.append(option);
    }
    size.value=String(apiPageSize);
    size.setAttribute("aria-label",t("每頁筆數","Page size"));
    const sort=dom(doc,"select","pm-api-sort");
    for(const field of ["owner","id","version","status"]) {
      const option=dom(doc,"option","",field);
      option.value=field;sort.append(option);
    }
    sort.value=apiSort;
    sort.setAttribute("aria-label",t("排序欄位","Sort by"));
    const order=dom(doc,"select","pm-api-sort-order");
    for(const value of ["asc","desc"]) {
      const option=dom(doc,"option","",value);
      option.value=value;order.append(option);
    }
    order.value=apiSortOrder;
    order.setAttribute("aria-label",t("排序方向","Sort order"));
    const exportStatus=dom(doc,"span","pm-muted");
    const exportButton=btn(doc,t("匯出完整 API 契約",
      "Export all API contracts"),async()=>{
      exportButton.disabled=true;
      try {
        const result=await core.exportLiveCatalog("ui","user");
        if(!result.ok) {
          exportStatus.textContent=t("匯出失敗：","Export failed: ")+
            (result.error??String(result.status));
          return;
        }
        const blob=new Blob([result.value.json],{
          type:"application/json;charset=utf-8"
        });
        const url=URL.createObjectURL(blob);
        const link=doc.createElement("a");
        link.href=url;
        link.download="ClusterOpt2-API-Contracts.json";
        link.click();
        URL.revokeObjectURL(url);
        exportStatus.textContent="SHA-256: "+result.value.sha256;
      } catch (_error) {
        exportStatus.textContent=t("匯出失敗","Export failed");
      } finally {
        exportButton.disabled=false;
      }
    },"pm-mini");
    controls.append(kind,input,size,sort,order,
      exportButton,exportStatus);
    body.append(controls);
    const selectedProvider=current();
    if(selectedProvider) {
      const capabilitySummary=dom(doc,"div","pm-api-capabilities");
      capabilitySummary.append(dom(doc,"strong","",
        t("目前插件可用 Capability","Selected plugin capabilities")+
          ": "+selectedProvider.providerId));
      for(const permission of selectedProvider.permissions) {
        const approved=core.checkPluginPermission(
          selectedProvider.providerId,permission);
        capabilitySummary.append(dom(doc,"p","pm-muted",
          permission+" — "+(approved ? "Allowed" : "Denied")));
      }
      const handle=core.pluginHostInstaller.handles.get(
        selectedProvider.providerId);
      for(const scope of handle?.listHostRPCScopes?.() ?? []) {
        capabilitySummary.append(dom(doc,"p","pm-muted",
          "RPC Scope — "+scope.target+"."+scope.action+
          (scope.property ? "("+scope.property+")" : "")));
      }
      if(!selectedProvider.permissions.length &&
          !(handle?.listHostRPCScopes?.()?.length)) {
        capabilitySummary.append(dom(doc,"p","pm-muted",
          t("此插件尚無已宣告的權限與 RPC Scope",
            "No declared permissions or active RPC scopes")));
      }
      body.append(capabilitySummary);
    }
    const container=dom(doc,"div","pm-api-table-wrap");
    const table=dom(doc,"table","pm-api-table");
    const head=dom(doc,"thead");
    const headings=dom(doc,"tr");
    for(const title of [
      t("種類","Kind"),"API / Action",t("所屬物件","Owner"),
      t("版本","Version"),t("狀態","Status"),
      t("權限","Permission")
    ]) headings.append(dom(doc,"th","",title));
    head.append(headings);
    const rows=dom(doc,"tbody");
    table.append(head,rows);
    container.append(table);
    const footer=dom(doc,"div","pm-api-pagination");
    const previous=btn(doc,t("上一頁","Previous"),()=>{
      if(apiPageIndex===0)return;
      apiPageIndex--;
      update();
    },"pm-mini");
    const next=btn(doc,t("下一頁","Next"),()=>{
      if(!lastNextCursor)return;
      apiPageIndex++;
      apiCursors[apiPageIndex]=lastNextCursor;
      update();
    },"pm-mini");
    const pageLabel=dom(doc,"span","pm-muted");
    const warning=dom(doc,"p","pm-muted");
    footer.append(previous,pageLabel,next);
    body.append(container,footer,warning);
    section.append(body);

    let lastNextCursor=null;
    function resetPage() {
      apiPageIndex=0;apiCursors=[null];lastNextCursor=null;
    }
    function update() {
      const requestedPage=apiPageIndex;
      const result=core.discover("ui","page",apiKind,{
        term:apiQuery.trim(),limit:apiPageSize,
        sortBy:apiSort,sortOrder:apiSortOrder,
        cursor:apiCursors[requestedPage]??null
      },{origin:"user"});
      rows.replaceChildren();
      if(!result.ok) {
        if(result.status===409) {
          resetPage();
          warning.textContent=t("API 契約已更新，請重新查詢",
            "API contracts changed. Search again.");
        } else {
          warning.textContent=t("API 讀取失敗：",
            "API query failed: ")+(result.error??result.status);
        }
        previous.disabled=true;next.disabled=true;
        return;
      }
      warning.textContent="";
      const data=result.value;
      apiRevision=data.snapshotRevision;
      lastNextCursor=data.nextCursor;
      for(const item of data.items) {
        const row=dom(doc,"tr","pm-api-table-row");
        const values=[
          apiKind+" / "+item.audience,item.id,item.owner,
          item.version??"—",
          item.status,(item.capability??[]).join(", ")||
            item.visibility
        ];
        values.forEach((value,index)=>{
          const cell=dom(doc,"td","",value);
          if(index===1) {
            const open=btn(doc,value,()=>{
              const response=core.discover("ui","describeLive",
                apiKind,{ id:item.id,
                  owner:["api","service","event"].includes(apiKind)?
                    item.owner:null },{origin:"user"});
              if(!response.ok) {
                warning.textContent=t("契約已變更：",
                  "Contract changed: ")+response.status;
                return;
              }
              const descriptor=response.value.descriptor;
              const entry={kind:apiKind==="api"?"Request":
                  apiKind==="service"?"Provider":
                  apiKind==="protocol"?"Protocol":apiKind,
                id:item.id,owner:item.owner,descriptor};
              body.replaceChildren();
              renderContractDetail(doc,body,entry,t,()=>render(),
                ()=>core.inspectLiveContract("ui",apiKind,item.id,
                  ["api","service","event"].includes(apiKind) ?
                    item.owner : null,"user"));
            },"pm-api-row-link");
            cell.replaceChildren(open);
          }
          row.append(cell);
        });
        rows.append(row);
      }
      if(!data.items.length) {
        const empty=dom(doc,"tr");
        const cell=dom(doc,"td","pm-muted",
          t("沒有符合的 API 契約","No matching API contracts"));
        cell.colSpan=6;empty.append(cell);rows.append(empty);
      }
      pageLabel.textContent=t("第 ","Page ")+
        (apiPageIndex+1)+t(" 頁，共 "," of ")+data.total+
        t(" 筆"," records");
      previous.disabled=apiPageIndex===0;
      next.disabled=!lastNextCursor;
    }
    kind.addEventListener("change",()=>{
      apiKind=kind.value;resetPage();update();
    });
    size.addEventListener("change",()=>{
      apiPageSize=Number(size.value);resetPage();update();
    });
    input.addEventListener("input",()=>{
      apiQuery=input.value;resetPage();update();
    });
    sort.addEventListener("change",()=>{
      apiSort=sort.value;resetPage();update();
    });
    order.addEventListener("change",()=>{
      apiSortOrder=order.value;resetPage();update();
    });
    update();
    refreshAPIPage=()=>{
      if(!page.contains(section))return;
      const current=core.discover("ui","page",apiKind,{
        term:apiQuery.trim(),limit:1,
        sortBy:apiSort,sortOrder:apiSortOrder
      },{origin:"user"});
      if(current.ok && current.value.snapshotRevision!==apiRevision) {
        resetPage();
        update();
      }
    };
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
      if(active==="api"&&refreshAPIPage&&
          Date.now()-lastApiCheckTime>=1000) {
        lastApiCheckTime=Date.now();
        refreshAPIPage();
      }
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
