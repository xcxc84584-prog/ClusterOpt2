import { PluginMessagePolicy } from "../property/PluginMessagePolicy.js";

/**
 * PR23.1 - PluginManagerUnit (PMU).
 * This is a host-only facade, not a second registry or execution engine.
 * Untrusted plugins receive only a host-bound channel, never PMU or LinkCore.
 * HubUnit, URU, EDPMU, and PluginUIHostUnit remain the authorities.
 */
const fail = (status, error) => ({ ok: false, status, error });
const good = value => ({ ok: true, status: 200, value });
const CHANNELS = new Set(["permission", "request", "response"]);
const UNITS = new Set(["OCU", "PCU", "UCU"]);

class ControlUnit {
  constructor(core) {
    this.core = core;
    // Four named responsibilities; all are adapters over existing units.
    this.registrar = Object.freeze({
      resolve: providerId => core.uru.getProvider(providerId)
    });
    this.bridge = Object.freeze({});
    this.permissions = Object.freeze({
      allows: (providerId, permission) =>
        core.checkPluginPermission(providerId, permission)
    });
    this.forwarder = Object.freeze({});
  }

  authorize(actor, permission = null) {
    const provider = this.registrar.resolve(actor.providerId);
    if (!provider || !this.core.uru.objects.has(provider.objectId) ||
        this.core.uru.disabledProviders.has(actor.providerId)) {
      return fail(403, "Provider inactive or not registered");
    }
    if (permission && !this.permissions.allows(
      actor.providerId, permission)) {
      return fail(403, "Capability not granted");
    }
    return good(provider);
  }
}

export class ObjectControlUnit extends ControlUnit {
  constructor(core) {
    super(core);
    this.bridge = Object.freeze({
      request: (source, target, action, payload, origin) =>
        core.request(source, target, action, payload, { origin }),
      service: (source, service, action, payload, origin) =>
        core.requestService(source, service, action, payload, { origin })
    });
    this.forwarder = Object.freeze({
      dispatch: (actor, request) => this.dispatch(actor, request)
    });
  }

  async dispatch(actor, request) {
    const auth = this.authorize(actor, request.permission);
    if (!auth.ok) return auth;
    const { target, service, action, payload = {} } = request;
    if (typeof action !== "string" || !action ||
        (typeof target !== "string" && typeof service !== "string") ||
        (target !== undefined && service !== undefined)) {
      return fail(400, "Invalid Object request");
    }
    const source = auth.value.objectId;
    return service === undefined ?
      this.bridge.request(source, target, action, payload, actor.origin) :
      this.bridge.service(source, service, action, payload, actor.origin);
  }
}

export class PropertyControlUnit extends ControlUnit {
  constructor(core) {
    super(core);
    this.bridge = Object.freeze({
      read: (source, name) => core.readProperty(source, name),
      publish: (source, id, name, value) =>
        core.publishProviderProperty(source, id, name, value)
    });
    this.forwarder = Object.freeze({
      dispatch: (actor, request) => this.dispatch(actor, request)
    });
  }

  dispatch(actor, request) {
    const auth = this.authorize(actor, request.permission);
    if (!auth.ok) return auth;
    if (typeof request.name !== "string" || !request.name) {
      return fail(400, "Invalid Property name");
    }
    if (request.action === "read") {
      return this.bridge.read(auth.value.objectId, request.name);
    }
    if (request.action === "publish") {
      // Provider ownership and EDPMU write policy are checked by HubUnit.
      return this.bridge.publish(auth.value.objectId, actor.providerId,
        request.name, request.value);
    }
    return fail(400, "Unknown Property action");
  }
}

export class UIControlUnit extends ControlUnit {
  constructor(core) {
    super(core);
    // Reuse the installed PluginUIHostUnit; never write into host DOM.
    const uiHost = core.pluginHostInstaller.uiHost;
    this.registrar = Object.freeze({
      resolve: providerId => core.uru.getProvider(providerId),
      view: providerId => uiHost.views.get(providerId)
    });
    this.bridge = Object.freeze({
      open: view => {
        if (view.workbenchTab) view.workbenchTab.open();
        else {
          view.panel.hidden = false;
          view.button.setAttribute("aria-pressed", "true");
        }
      },
      close: view => {
        if (view.workbenchTab) view.workbenchTab.deactivate();
        else {
          view.panel.hidden = true;
          view.button.setAttribute("aria-pressed", "false");
        }
      }
    });
    this.forwarder = Object.freeze({
      dispatch: (actor, request) => this.dispatch(actor, request)
    });
  }

  dispatch(actor, request) {
    const auth = this.authorize(actor, request.permission);
    if (!auth.ok) return auth;
    const view = this.registrar.view(actor.providerId);
    if (!view) return fail(404, "Provider UI is not mounted");
    if (request.action === "state") {
      return good({ mounted: true, enabled: view.enabled,
        visible: view.enabled && !view.panel.hidden });
    }
    if (request.action !== "open" && request.action !== "close") {
      return fail(400, "Unsupported UI action");
    }
    if (!view.enabled) return fail(403, "Provider UI disabled");
    this.bridge[request.action](view);
    return good({ visible: request.action === "open" });
  }
}

export class PluginManagerUnit {
  constructor(core) {
    this.core = core;
    this.OCU = new ObjectControlUnit(core);
    this.PCU = new PropertyControlUnit(core);
    this.UCU = new UIControlUnit(core);
    this.pendingResponses = new Map();
    this.nextId = 0;
  }

  audit(actor, kind, status, target) {
    this.core.omu.record(status >= 400 ? "EHU" : "Log",
      actor?.providerId ?? "unknown", "PMU." + kind, status,
      target ?? "");
  }

  /**
   * Host-only: bind identity AFTER verifying the provider session.
   * The returned object has exactly three external message channels.
   * A caller cannot supply or override its own providerId / origin.
   */
  bind(providerId, origin = "user") {
    if (!["user", "agent"].includes(origin)) {
      throw new TypeError("Invalid authenticated origin");
    }
    const actor = Object.freeze({ providerId, origin });
    const manager = this;
    return Object.freeze({
      permission: message => manager.permission(actor, message),
      request: message => manager.request(actor, message),
      response: message => manager.response(actor, message)
    });
  }

  inspect(message) {
    const parsed = PluginMessagePolicy.inspect(message);
    return parsed.ok ? good(parsed.value) :
      fail(parsed.status, "Invalid PMU message");
  }

  permission(actor, message) {
    const parsed = this.inspect(message);
    if (!parsed.ok) return parsed;
    const permission = parsed.value.permission;
    if (typeof permission !== "string" || !permission) {
      return fail(400, "Invalid permission");
    }
    const provider = this.core.uru.getProvider(actor.providerId);
    const status = !provider || !provider.permissions.includes(permission) ?
      403 : this.core.checkPluginPermission(actor.providerId, permission) ?
        200 : 202;
    this.audit(actor, "Permission", status, permission);
    return status === 403 ? fail(403, "Permission undeclared") :
      { ok: status === 200, status,
        value: { granted: status === 200, requiresHostApproval: status === 202 } };
  }

  /** Trusted host only; UI consent must be obtained outside this method. */
  grantFromHost(providerId, permission, approved = false) {
    if (approved !== true) return fail(403, "Host approval required");
    const provider = this.core.uru.getProvider(providerId);
    if (!provider) return fail(404, "Unknown Provider");
    return this.core.grantPluginPermission(
      provider.objectId, providerId, permission, true);
  }

  async request(actor, message) {
    const parsed = this.inspect(message);
    if (!parsed.ok) return parsed;
    const { unit, ...request } = parsed.value;
    if (!UNITS.has(unit)) return fail(400, "Unknown PMU unit");
    const result = await this[unit].forwarder.dispatch(actor, request);
    this.audit(actor, "Request." + unit, result.status,
      request.target ?? request.service ?? request.name ?? "");
    return result;
  }

  /**
   * Explicit asynchronous REP ingress. Only a host-registered request ID
   * from the same authenticated Provider can complete a pending reply.
   */
  expectResponse(providerId, callback) {
    if (typeof callback !== "function" ||
        this.pendingResponses.size >= 128) {
      return fail(429, "Response capacity exceeded");
    }
    const provider = this.core.uru.getProvider(providerId);
    if (!provider) return fail(404, "Unknown Provider");
    const requestId = "pmu-" + (++this.nextId);
    this.pendingResponses.set(requestId, {
      providerId, callback, expires: Date.now() + 30000
    });
    return good({ requestId });
  }

  response(actor, message) {
    const parsed = this.inspect(message);
    if (!parsed.ok) return parsed;
    const { requestId, value } = parsed.value;
    const pending = this.pendingResponses.get(requestId);
    if (!pending || pending.providerId !== actor.providerId) {
      return fail(403, "Unsolicited or foreign Response");
    }
    this.pendingResponses.delete(requestId);
    if (pending.expires < Date.now() ||
        !this.core.uru.getProvider(actor.providerId)) {
      return fail(410, "Response expired");
    }
    try {
      pending.callback(value);
      this.audit(actor, "Response", 200, requestId);
      return good({ received: true });
    } catch {
      this.audit(actor, "Response", 500, requestId);
      return fail(500, "Response callback failed");
    }
  }
}
