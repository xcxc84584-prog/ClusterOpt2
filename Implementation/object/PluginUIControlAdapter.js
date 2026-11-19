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

  owned(uiId, source) {
    const item = this.nodes.get(uiId);
    if (!item) return fail(404, "UI control unavailable");
    if (item.owner !== source) return fail(403, "UI owner mismatch");
    return item;
  }

  create(source, request) {
    if (!this.doc) return fail(503, "DOM host unavailable");
    const payload = request.payload;
    const slotId = SLOTS[payload.parentId];
    if (!slotId) return fail(403, "UI insertion slot denied");
    const slot = this.doc.getElementById(slotId);
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

  teardownOwner(ownerId) {
    for (const [id, item] of [...this.nodes]) {
      if (item.owner === ownerId) this.remove(id, ownerId);
    }
  }
}
