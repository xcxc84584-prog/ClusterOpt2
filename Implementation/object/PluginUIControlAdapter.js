import { PluginUIViewPolicy } from
  "../property/PluginUIViewPolicy.js";

/**
 * PR23 — bounded DOM adapter for plugin-owned controls only.
 * Native host UI stays immutable; no HTML injection or arbitrary selectors.
 * URU / HubUnit remain the identity and permission authorities.
 */
const SLOTS = Object.freeze({
  "slot.plugin-toolbar": "toolOptions",
  "slot.plugin-window": "clusterWorkspaceShell"
});
const COLOR = /^#[0-9a-fA-F]{6}$/;
const TEXT_LIMIT = 512;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function applyProps(node, props) {
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    return fail(400, "Invalid UI props");
  }
  const allowed = new Set([
    "text", "color", "background", "width", "height", "x", "y"
  ]);
  if (Object.keys(props).some(key => !allowed.has(key))) {
    return fail(400, "Unsupported UI property");
  }
  for (const key of ["text", "color", "background"]) {
    if (props[key] === undefined) continue;
    if (typeof props[key] !== "string" ||
        props[key].length > TEXT_LIMIT) {
      return fail(400, "Invalid text or color");
    }
    if (key !== "text" && !COLOR.test(props[key])) {
      return fail(400, "Unsafe color value");
    }
  }
  for (const key of ["width", "height", "x", "y"]) {
    if (props[key] !== undefined &&
        (typeof props[key] !== "number" ||
         !Number.isFinite(props[key]) ||
         Math.abs(props[key]) > 10000 ||
         (["width", "height"].includes(key) && props[key] < 0))) {
      return fail(400, "Invalid geometry");
    }
  }
  if (props.text !== undefined) node.textContent = props.text;
  if (props.color !== undefined) node.style.color = props.color;
  if (props.background !== undefined) {
    node.style.backgroundColor = props.background;
  }
  if (props.width !== undefined) node.style.width = props.width + "px";
  if (props.height !== undefined) node.style.height = props.height + "px";
  if (props.x !== undefined || props.y !== undefined) {
    node.style.position = "relative";
    if (props.x !== undefined) node.style.left = props.x + "px";
    if (props.y !== undefined) node.style.top = props.y + "px";
  }
}

export class PluginUIControlAdapter {
  constructor(core, doc = typeof document !== "undefined" ? document : null) {
    this.core = core;
    this.doc = doc;
    // DOM references only. URU owns the externally visible identities.
    this.nodes = new Map();
  }

  /**
   * A toolbar plugin must never be mounted inside hidden File Tool
   * menus. Prefer the visible header; retain the old slot only when
   * running a reduced/embedded Host lacking a header.
   */
  resolveSlot(parentId) {
    if (!Object.hasOwn(SLOTS, parentId)) return null;
    if (parentId === "slot.plugin-toolbar") {
      return this.doc?.querySelector(".header-utility") ??
        this.doc?.getElementById(SLOTS[parentId]);
    }
    return this.doc?.getElementById(SLOTS[parentId]);
  }

  owned(uiId, source) {
    const item = this.nodes.get(uiId);
    if (!item) return fail(404, "UI control unavailable");
    if (item.owner !== source) return fail(403, "UI owner mismatch");
    return item;
  }

  create(source, request) {
    if (!this.doc) return fail(503, "DOM host unavailable");
    const payload = request.payload;
    if (!Object.hasOwn(SLOTS, payload.parentId)) {
      return fail(403, "UI insertion slot denied");
    }
    const slot = this.resolveSlot(payload.parentId);
    if (!slot) return fail(404, "UI slot unavailable");
    if (!["button", "panel", "window", "menu-item"].includes(payload.kind)) {
      return fail(400, "Unsupported UI control kind");
    }
    const count = [...this.nodes.values()].filter(
      item => item.owner === source).length;
    if (count >= 50) return fail(429, "UI control budget exceeded");
    const uiId = source + "." + request.requestId;
    if (this.nodes.has(uiId) || this.core.uru.objects.has("UICO." + uiId)) {
      return fail(409, "Duplicate UI identity");
    }
    const node = this.doc.createElement(
      ["button", "menu-item"].includes(payload.kind) ? "button" :
      payload.kind === "window" ? "section" : "div");
    node.id = "cluster-plugin-" + uiId.replaceAll(".", "-");
    node.dataset.clusterPluginUi = uiId;
    if (node.tagName === "BUTTON") node.type = "button";
    if (payload.kind === "window") {
      node.setAttribute("role", "dialog");
      node.setAttribute("aria-label", "Plugin window");
      node.style.position = "relative";
      node.style.maxWidth = "min(480px, 90vw)";
      node.style.border = "1px solid currentColor";
      node.style.padding = "12px";
    }
    applyProps(node, payload.props);
    if (node.tagName === "BUTTON" && payload.onActivateAction) {
      const action = payload.onActivateAction;
      node.addEventListener("click", () => {
        void this.core.request("UICO", source, action,
          { uiId }, { origin: "user" });
      });
    }
    const entry = {
      id: "UICO." + uiId,
      parentPath: "UICO",
      receive: async action => action === "getState" ?
        this.state(uiId, source) : fail(404, "Unknown UI action"),
      authorization: { default: "Private", getState: "Protected" }
    };
    if (!this.core.register(entry)) {
      return fail(409, "UI registry collision");
    }
    try {
      slot.appendChild(node);
      this.nodes.set(uiId, { node, source, owner: source,
        kind: payload.kind, revision: 1, tabs: new Map() });
    } catch {
      this.core.unregister(entry.id);
      return fail(500, "UI mount failed");
    }
    return { uiId, revision: 1, kind: payload.kind };
  }

  state(uiId, source) {
    const item = this.owned(uiId, source);
    const rect = item.node.getBoundingClientRect();
    return {
      uiId, kind: item.kind, revision: item.revision,
      visible: !item.node.hidden,
      geometry: {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height
      }
    };
  }

  update(uiId, source, payload) {
    const item = this.owned(uiId, source);
    if (payload.expectedRevision !== undefined &&
        payload.expectedRevision !== item.revision) {
      return fail(409, "Stale UI revision");
    }
    // Validate changes on a detached element before touching live DOM.
    const trial = item.node.cloneNode(false);
    applyProps(trial, payload.props);
    applyProps(item.node, payload.props);
    item.revision++;
    return this.state(uiId, source);
  }

  remove(uiId, source) {
    const item = this.owned(uiId, source);
    item.node.remove();
    this.nodes.delete(uiId);
    this.core.unregister("UICO." + uiId);
    return { uiId, removed: true };
  }

  setVisibility(uiId, source, visible) {
    const item = this.owned(uiId, source);
    item.node.hidden = visible !== true;
    item.revision++;
    return this.state(uiId, source);
  }

  focus(uiId, source) {
    const item = this.owned(uiId, source);
    item.node.focus();
    return { uiId, focused: this.doc.activeElement === item.node };
  }

  getProperty(uiId, source, property) {
    const state = this.state(uiId, source);
    if (!Object.hasOwn(state, property)) {
      return fail(404, "UI property unavailable");
    }
    return { uiId, property, value: state[property] };
  }

  /**
   * PR23.8 bounded batch: preflight all operations before mutation, then
   * journal inverse operations. HubUnit serializes the UICO Object lane.
   */
  batch(source, request, allowsCapability) {
    const ops = request.payload.operations;
    const seen = new Set();
    const plans = [];
    let additions = 0;
    for (let index = 0; index < ops.length; index++) {
      const op = ops[index];
      const capability = op.action === "UI.Create" ?
        "ui.create.own" : "ui.update.own";
      if (!allowsCapability(capability)) {
        return fail(403, "Batch capability denied");
      }
      if (op.action === "UI.Create") {
        if (!this.doc) return fail(503, "DOM host unavailable");
        const p = op.payload;
        if (!this.resolveSlot(p.parentId)) {
          return fail(403, "Batch insertion slot denied");
        }
        if (!["button", "panel", "window", "menu-item"].includes(p.kind)) {
          return fail(400, "Invalid batch control kind");
        }
        const temporary = this.doc.createElement("div");
        applyProps(temporary, p.props);
        const id = source + "." + request.requestId + "_" + index;
        if (id.length > 128 || seen.has(id) ||
            this.nodes.has(id) || this.core.uru.objects.has("UICO." + id)) {
          return fail(409, "Duplicate batch UI identity");
        }
        additions++;
        seen.add(id);
        plans.push({ action: op.action, payload: p,
          requestId: request.requestId + "_" + index, uiId: id });
      } else {
        const p = op.payload;
        if (seen.has(p.uiId)) {
          return fail(409, "Conflicting batch target");
        }
        const item = this.owned(p.uiId, source);
        if (p.expectedRevision !== undefined &&
            p.expectedRevision !== item.revision) {
          return fail(409, "Stale batch revision");
        }
        if (op.action === "UI.Update") {
          const detached = item.node.cloneNode(false);
          applyProps(detached, p.props);
        }
        seen.add(p.uiId);
        plans.push({ action: op.action, payload: p, uiId: p.uiId });
      }
    }
    const liveCount = [...this.nodes.values()].filter(
      item => item.owner === source).length;
    if (liveCount + additions > 50) {
      return fail(429, "Batch UI budget exceeded");
    }
    const undo = [];
    const output = [];
    try {
      for (const plan of plans) {
        if (plan.action === "UI.Create") {
          const created = this.create(source, {
            requestId: plan.requestId, payload: plan.payload
          });
          undo.push(() => this.remove(created.uiId, source));
          output.push(created);
        } else if (plan.action === "UI.Update") {
          const item = this.owned(plan.uiId, source);
          const style = item.node.style.cssText;
          const text = item.node.textContent;
          const revision = item.revision;
          undo.push(() => {
            item.node.style.cssText = style;
            item.node.textContent = text;
            item.revision = revision;
          });
          output.push(this.update(plan.uiId, source, plan.payload));
        } else {
          const item = this.owned(plan.uiId, source);
          const parent = item.node.parentNode;
          const after = item.node.nextSibling;
          const object = this.core.uru.objects.get("UICO." + plan.uiId);
          const removed = this.remove(plan.uiId, source);
          undo.push(() => {
            if (object) this.core.register(object);
            if (parent) parent.insertBefore(item.node,
              after?.parentNode === parent ? after : null);
            this.nodes.set(plan.uiId, item);
          });
          output.push(removed);
        }
      }
      return { operations: output, atomic: true };
    } catch (error) {
      for (const revert of undo.reverse()) {
        try { revert(); } catch {
          this.core.omu.record("EHU", source, "UI.Batch.Rollback",
            500, "UICO");
        }
      }
      throw error;
    }
  }

  addTab(uiId, source, tabId, title) {
    const item = this.owned(uiId, source);
    if (item.kind !== "window") return fail(400, "Not a tabbed window");
    if (item.tabs.has(tabId)) return fail(409, "Duplicate tab");
    if (item.tabs.size >= 12 ||
        typeof title !== "string" || title.length > 128) {
      return fail(400, "Invalid tab metadata");
    }
    const button = this.doc.createElement("button");
    button.type = "button";
    button.textContent = title;
    button.setAttribute("role", "tab");
    button.dataset.pluginTab = tabId;
    button.addEventListener("click", () => {
      for (const [id, tab] of item.tabs) {
        tab.setAttribute("aria-selected", String(id === tabId));
      }
      item.activeTab = tabId;
    });
    item.node.appendChild(button);
    item.tabs.set(tabId, button);
    if (item.tabs.size === 1) button.click();
    item.revision++;
    return { uiId, tabId, revision: item.revision };
  }

  removeTab(uiId, source, tabId) {
    const item = this.owned(uiId, source);
    const button = item.tabs.get(tabId);
    if (!button) return fail(404, "Unknown tab");
    button.remove();
    item.tabs.delete(tabId);
    if (item.activeTab === tabId) {
      item.activeTab = null;
      item.tabs.values().next().value?.click();
    }
    item.revision++;
    return { uiId, tabId, revision: item.revision };
  }

  navigate(uiId, source, viewId, providerId) {
    const item = this.owned(uiId, source);
    if (item.kind !== "window") return fail(400, "Not a plugin window");
    const host = this.core.pluginHostInstaller?.uiHost;
    const installed = host?.views.get(providerId);
    if (!installed || installed.provider?.objectId !== source ||
        !installed.enabled) {
      return fail(403, "Plugin UI package unavailable");
    }
    const view = PluginUIViewPolicy.read(installed.snapshot, viewId);
    if (!view.ok) return fail(view.status, "Invalid plugin view asset");
    const frame = item.frame ?? this.doc.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("title", viewId);
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.removeAttribute("src");
    frame.srcdoc = view.srcdoc;
    if (!item.frame) item.node.appendChild(frame);
    item.frame = frame;
    item.revision++;
    return { uiId, viewId, revision: item.revision };
  }

  subscribe(uiId, source, subscriptionId) {
    const item = this.owned(uiId, source);
    item.subscriptions ??= new Map();
    if (item.subscriptions.has(subscriptionId)) {
      return fail(409, "Duplicate UI subscription");
    }
    if (item.subscriptions.size >= 10) {
      return fail(429, "Subscription quota exceeded");
    }
    const listener = () => {
      void this.core.request("UICO", source, subscriptionId,
        { uiId }, { origin: "user" });
    };
    item.node.addEventListener("click", listener);
    item.subscriptions.set(subscriptionId, listener);
    return { uiId, subscriptionId, active: true };
  }

  unsubscribe(uiId, source, subscriptionId) {
    const item = this.owned(uiId, source);
    const listener = item.subscriptions?.get(subscriptionId);
    if (!listener) return fail(404, "Subscription not found");
    item.node.removeEventListener("click", listener);
    item.subscriptions.delete(subscriptionId);
    return { uiId, subscriptionId, active: false };
  }

  teardownOwner(ownerId) {
    for (const [id, item] of [...this.nodes]) {
      if (item.owner === ownerId) this.remove(id, ownerId);
    }
  }
}
