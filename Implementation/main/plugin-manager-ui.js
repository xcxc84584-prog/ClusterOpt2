/**
 * PLUGIN PR06.08: four separate Plugin Manager pages.
 * Read-only plugin metadata comes from URU and OMU; no sample data.
 * A trusted DOM event can revoke a grant, but cannot self-authorize one.
 */
const PAGES = Object.freeze([
  ["list", "插件列表 / Plugins"],
  ["permissions", "插件權限 / Permissions"],
  ["api", "API 列表 / API"],
  ["ehu", "EHU 日誌 / EHU"]
]);

function element(doc, tag, className, value) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = String(value);
  return node;
}

function addRow(doc, parent, cells) {
  const tr = element(doc, "tr");
  for (const value of cells) tr.append(element(doc, "td", "", value));
  parent.append(tr);
}

export function mountPluginManagerUI(core, doc) {
  const host = doc.getElementById("pluginManagerPages");
  const legacy = doc.getElementById("pluginLegacySettings");
  const tools = doc.getElementById("pluginToolToggle");
  const legacyMenu = doc.getElementById("pluginLegacyMenu");
  if (!host || !legacy || !tools || !legacyMenu) {
    throw Error("Plugin Manager DOM is missing");
  }
  const shell = element(doc, "div", "plugin-manager");
  const nav = element(doc, "nav", "plugin-manager-nav");
  nav.setAttribute("aria-label", "Plugin Manager pages");
  const content = element(doc, "div", "plugin-manager-page");
  const tabs = new Map();
  const headings = new Map();
  let active = "list";
  let selected = "";
  let searchText = "";
  let filter = "all";

  const title = (name, description) => {
    const head = element(doc, "div", "plugin-manager-head");
    const left = element(doc, "div");
    left.append(element(doc, "h3", "", name),
      element(doc, "p", "plugin-manager-muted", description));
    head.append(left);
    content.append(head);
    return head;
  };
  const card = () => {
    const node = element(doc, "section", "plugin-manager-card");
    content.append(node);
    return node;
  };
  const button = (caption, action, disabled = false) => {
    const node = element(doc, "button", "", caption);
    node.type = "button";
    node.disabled = disabled;
    node.addEventListener("click", action);
    return node;
  };
  const data = () => core.uru.listProviders();
  const status = provider => core.uru.disabledProviders
    .has(provider.providerId) ? "Disabled" : "Enabled";
  const empty = message =>
    content.append(element(doc, "p", "plugin-manager-muted", message));

  function listPage() {
    const head = title("插件列表", "已註冊的 Provider，沒有自動安裝功能");
    const search = element(doc, "input", "plugin-manager-search");
    search.type = "search";
    search.value = searchText;
    search.placeholder = "搜尋插件 ID / Object";
    search.setAttribute("aria-label", "搜尋插件");
    search.addEventListener("input", () => {
      searchText = search.value;
      draw();
    });
    const chooser = element(doc, "select", "plugin-manager-filter");
    chooser.setAttribute("aria-label", "插件狀態篩選");
    for (const [value, caption] of [
      ["all", "全部"], ["enabled", "啟用"], ["disabled", "停用"]
    ]) {
      const item = element(doc, "option", "", caption);
      item.value = value;
      chooser.append(item);
    }
    chooser.value = filter;
    chooser.addEventListener("change", () => {
      filter = chooser.value;
      draw();
    });
    head.append(search, chooser);
    const shown = data().filter(p =>
      (p.providerId.toLowerCase().includes(searchText.toLowerCase()) ||
        p.objectId.toLowerCase().includes(searchText.toLowerCase())) &&
      (filter === "all" || status(p).toLowerCase() === filter));
    if (!shown.length) return empty("目前沒有符合條件的插件。");
    for (const provider of shown) {
      const row = card();
      const line = element(doc, "div", "plugin-manager-line");
      const details = element(doc, "div");
      details.append(
        element(doc, "div", "plugin-manager-title", provider.providerId),
        element(doc, "div", "plugin-manager-muted",
          provider.objectId + " · " + status(provider) +
          " · " + provider.execution.isolation));
      line.append(details, button("權限", () => {
        selected = provider.providerId;
        activate("permissions");
      }));
      row.append(line);
    }
  }

  function permissionsPage() {
    title("插件權限", "只顯示 Manifest 申請與實際 Grant；禁止由頁面自行提升權限");
    const providers = data();
    if (!providers.length) return empty("尚無已註冊插件可供授權。");
    const ordered = [...providers].sort((a, b) =>
      Number(b.providerId === selected) - Number(a.providerId === selected));
    for (const provider of ordered) {
      const section = card();
      section.append(element(doc, "div", "plugin-manager-title",
        provider.providerId));
      if (!provider.permissions.length) {
        section.append(element(doc, "p", "plugin-manager-muted",
          "未申請任何權限"));
      }
      for (const permission of provider.permissions) {
        const granted = core.checkPluginPermission(
          provider.providerId, permission);
        const row = element(doc, "div", "plugin-manager-line");
        row.append(element(doc, "span", "",
          permission + " · " + (granted ? "已授權" : "未授權")));
        const revoke = button(granted ? "撤銷" : "需經安全審核",
          () => {
            const result = core.revokePluginPermission(
              provider.objectId, provider.providerId, permission);
            if (result.ok) draw();
          }, !granted);
        row.append(revoke);
        section.append(row);
      }
    }
    empty("授予權限需由可信的明確同意流程完成，不能透過 Manifest 自行取得。");
  }

  function apiPage() {
    title("API 列表", "由 URU Provider Manifest 即時產生");
    const providers = data();
    if (!providers.length) return empty("目前沒有 Provider API。");
    const section = card();
    const table = element(doc, "table", "plugin-manager-table");
    const head = element(doc, "thead");
    const tr = element(doc, "tr");
    for (const label of ["Provider", "Service", "Action", "Version"]) {
      tr.append(element(doc, "th", "", label));
    }
    head.append(tr);
    table.append(head);
    const body = element(doc, "tbody");
    for (const provider of providers) {
      for (const item of provider.provides) {
        addRow(doc, body, [provider.providerId,
          item.service, item.action, item.version]);
      }
    }
    table.append(body);
    section.append(table);
  }

  function ehuPage() {
    title("EHU 日誌", "只讀取 OMU 錯誤記錄，不顯示原始敏感 Payload");
    const logs = core.getSnapshot().logs.filter(event =>
      event.kind === "EHU").slice(-100).reverse();
    if (!logs.length) return empty("目前沒有 EHU 錯誤紀錄。");
    const section = card();
    const table = element(doc, "table", "plugin-manager-table");
    const head = element(doc, "thead");
    const tr = element(doc, "tr");
    for (const label of ["時間", "來源", "事件", "狀態"]) {
      tr.append(element(doc, "th", "", label));
    }
    head.append(tr);
    table.append(head);
    const body = element(doc, "tbody");
    for (const event of logs) {
      addRow(doc, body, [event.timestamp ?? "-",
        event.source ?? "-", event.action ?? "-", event.status ?? "-"]);
    }
    table.append(body);
    section.append(table);
  }

  const views = {
    list: listPage, permissions: permissionsPage,
    api: apiPage, ehu: ehuPage
  };
  function draw() {
    content.replaceChildren();
    views[active]();
    for (const [id, item] of tabs) {
      if (id === active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    }
  }
  function activate(id) {
    if (!Object.hasOwn(views, id)) return;
    active = id;
    tools.setAttribute("aria-pressed", "false");
    host.hidden = false;
    legacy.hidden = true;
    legacyMenu.hidden = true;
    draw();
  }
  for (const [id, label] of PAGES) {
    const item = button(label, () => activate(id));
    tabs.set(id, item);
    nav.append(item);
  }
  shell.append(nav, content);
  host.replaceChildren(shell);
  tools.addEventListener("click", () => {
    const opened = legacy.hidden;
    legacy.hidden = !opened;
    host.hidden = opened;
    legacyMenu.hidden = !opened;
    tools.setAttribute("aria-pressed", String(opened));
    if (!opened) draw();
  });
  activate(active);
  return Object.freeze({ refresh() {
    if (!host.hidden) draw();
  }, select: activate });
}
