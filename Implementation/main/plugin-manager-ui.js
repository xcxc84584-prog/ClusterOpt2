import { Language } from "../property/Language.js";
/**
 * PLUGIN PR06.08: four separate Plugin Manager pages.
 * Read-only plugin metadata comes from URU and OMU; no sample data.
 * A trusted DOM event can revoke a grant, but cannot self-authorize one.
 */
const PAGES = Object.freeze([
  ["list", "pluginPageList"],
  ["permissions", "pluginPagePermissions"],
  ["api", "pluginPageAPI"],
  ["ehu", "pluginPageEHU"]
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
  const t = key => Language.translate(
    core.readProperty("ui", "Language").value, key);
  let active = "list";
  let selected = "";
  let searchText = "";
  let filter = "all";
  let consent = null;
  const dialog = element(doc, "dialog", "plugin-consent-dialog");
  dialog.setAttribute("aria-labelledby", "pluginConsentTitle");
  const consentTitle = element(doc, "h3", "", "Plugin Permission Request");
  consentTitle.id = "pluginConsentTitle";
  const consentInfo = element(doc, "p", "plugin-manager-muted");
  const consentActions = element(doc, "div", "plugin-manager-actions");
  const refuse = element(doc, "button", "", "拒絕");
  const allow = element(doc, "button", "", "僅此工作階段允許");
  refuse.type = "button";
  allow.type = "button";
  consentActions.append(refuse, allow);
  dialog.append(consentTitle, consentInfo, consentActions);
  doc.getElementById("pluginWindow").append(dialog);
  function closeConsent() { consent = null; dialog.close(); }
  refuse.addEventListener("click", closeConsent);
  dialog.addEventListener("close", () => { consent = null; });
  allow.addEventListener("click", event => {
    if (!event.isTrusted || !consent) return;
    const { providerId, owner, permission, manifest } = consent;
    const current = core.uru.getProvider(providerId);
    if (!current || current !== manifest ||
        current.objectId !== owner ||
        !current.permissions.includes(permission)) {
      closeConsent();
      return;
    }
    const approved = core.grantPluginPermission(owner,
      providerId, permission, true);
    closeConsent();
    if (approved.ok) draw();
  });
  const askConsent = (provider, permission) => {
    if (dialog.open) return;
    consent = { providerId: provider.providerId,
      owner: provider.objectId, permission, manifest: provider };
    consentTitle.textContent = t("pluginPermissionConfirm");
    consentInfo.textContent = provider.providerId + " · " + permission +
      " · " + t("pluginPermissionSession");
    refuse.textContent = t("pluginPermissionReject");
    allow.textContent = t("pluginPermissionApprove");
    dialog.showModal();
  };

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
    const head = title(t("pluginPageList"), t("pluginListDesc"));
    const search = element(doc, "input", "plugin-manager-search");
    search.type = "search";
    search.value = searchText;
    search.placeholder = t("pluginListSearch");
    search.setAttribute("aria-label", t("pluginListSearch"));
    search.addEventListener("input", () => {
      const position = search.selectionStart;
      searchText = search.value;
      draw();
      const replacement = content.querySelector(".plugin-manager-search");
      replacement.focus();
      replacement.setSelectionRange(position, position);
    });
    const chooser = element(doc, "select", "plugin-manager-filter");
    chooser.setAttribute("aria-label", t("pluginListFilter"));
    for (const [value, caption] of [
      ["all", t("pluginAll")], ["enabled", t("pluginEnabled")],
      ["disabled", t("pluginDisabled")]
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
    if (!shown.length) return empty(t("pluginListEmpty"));
    for (const provider of shown) {
      const row = card();
      const line = element(doc, "div", "plugin-manager-line");
      const details = element(doc, "div");
      details.append(
        element(doc, "div", "plugin-manager-title", provider.providerId),
        element(doc, "div", "plugin-manager-muted",
          provider.objectId + " · " + status(provider) +
          " · " + provider.execution.isolation));
      line.append(details, button(t("pluginPermissionsShort"), () => {
        selected = provider.providerId;
        activate("permissions");
      }));
      row.append(line);
    }
  }

  function permissionsPage() {
    title(t("pluginPagePermissions"), t("pluginPermissionDesc"));
    const providers = data();
    if (!providers.length) return empty(t("pluginPermissionEmpty"));
    const ordered = [...providers].sort((a, b) =>
      Number(b.providerId === selected) - Number(a.providerId === selected));
    for (const provider of ordered) {
      const section = card();
      section.append(element(doc, "div", "plugin-manager-title",
        provider.providerId));
      if (!provider.permissions.length) {
        section.append(element(doc, "p", "plugin-manager-muted",
          t("pluginPermissionNone")));
      }
      for (const permission of provider.permissions) {
        const granted = core.checkPluginPermission(
          provider.providerId, permission);
        const row = element(doc, "div", "plugin-manager-line");
        row.append(element(doc, "span", "",
          permission + " · " + (granted ? t("pluginPermissionGranted") :
            t("pluginPermissionDenied"))));
        const revoke = button(granted ? t("pluginPermissionRevoke") :
          t("pluginPermissionReview"), () => {
            if (!granted) return askConsent(provider, permission);
            const result = core.revokePluginPermission(
              provider.objectId, provider.providerId, permission);
            if (result.ok) draw();
          });
        row.append(revoke);
        section.append(row);
      }
    }
    empty(t("pluginPermissionNotice"));
  }

  function apiPage() {
    title(t("pluginPageAPI"), t("pluginAPIDesc"));
    const providers = data();
    if (!providers.length) return empty(t("pluginAPIEmpty"));
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
    title(t("pluginPageEHU"), t("pluginEHUDesc"));
    const logs = core.getSnapshot().logs.filter(event =>
      event.kind === "EHU").slice(-100).reverse();
    if (!logs.length) return empty(t("pluginEHUEmpty"));
    const section = card();
    const table = element(doc, "table", "plugin-manager-table");
    const head = element(doc, "thead");
    const tr = element(doc, "tr");
    for (const label of [t("pluginTime"), t("pluginSource"),
      t("pluginEvent"), t("pluginState")]) {
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
      item.textContent = t(PAGES.find(p => p[0] === id)[1]);
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
  for (const [id, key] of PAGES) {
    const item = button(t(key), () => activate(id));
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
