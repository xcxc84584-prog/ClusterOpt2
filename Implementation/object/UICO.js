import { UISP } from "../property/UISP.js";
import { PluginUIControlAdapter } from "./PluginUIControlAdapter.js";
import { UIProtocolPolicy } from "../property/UIProtocolPolicy.js";
import { UIExtensionAPIPolicy } from
  "../property/UIExtensionAPIPolicy.js";

const SCHEMA = Object.freeze({ type: "object" });
const apiDescriptor = (id, owner, action, effect, description) =>
  Object.freeze({
    apiVersion: 1, id, owner, action, version: "1.0.0",
    visibility: "Public", sideEffect: effect,
    inputSchema: SCHEMA, outputSchema: SCHEMA, description
  });

const PERMISSION = Object.freeze({
  "00": "ui.api.extension.add",
  "01": "ui.api.extension.delete",
  "10": "ui.api.extension.query",
  "11": "ui.api.extension.update"
});

function failure(status, reason) {
  const error = new Error(reason);
  error.status = status;
  throw error;
}

/**
 * UICO is the UI-domain Object. HubUnit remains the sole Req/Rep/ACL
 * gateway; the URU owns host UI Object identity and EDPMU owns UISP.
 * Native UI bindings are intentionally read-only in this milestone.
 */
export class UICO {
  constructor(core) {
    this.id = "UICO";
    this.core = core;
    this.strictOCDA = true;
    this.surfaces = new Map();
    this.adapter = new PluginUIControlAdapter(core);
    this.authorization = Object.freeze({
      default: "Private",
      describe: "Public",
      list: "Public",
      extensionAPI: "Public",
      uiRequest: "Public"
    });
    this.ocda = Object.freeze({
      Request: Object.freeze(["describe", "list", "extensionAPI", "uiRequest"]),
      Response: Object.freeze(["describe", "list", "extensionAPI", "uiRequest"]),
      UserAPI: Object.freeze(["describe", "list", "extensionAPI", "uiRequest"]),
      AgentAPI: Object.freeze(["describe", "list", "extensionAPI", "uiRequest"]),
      Property: Object.freeze(["UISP"]),
      APIDescriptors: Object.freeze([
        apiDescriptor("UICO.describe", "UICO", "describe", "read",
          "Read host UI protocol identity and supported operations"),
        apiDescriptor("UICO.list", "UICO", "list", "read",
          "List registered UISP host UI surfaces"),
        apiDescriptor("UICO.extensionAPI", "UICO", "extensionAPI", "write",
          "Permission-scoped 2-bit plugin API extension operation"),
        apiDescriptor("UICO.uiRequest", "UICO", "uiRequest", "write",
          "Validated and authorized plugin UI protocol dispatcher")
      ]),
      Program: "UICO",
      EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
  }

  /**
   * Host-only registration. Never callable via UICO.receive or plugin RPC.
   * Publishes a stable, immutable native UI Object through the existing URU.
   */
  registerHostSurface(candidate, observe = null) {
    const validated = UISP.validate(candidate);
    if (!validated.ok) return { ok: false, status: 400 };
    const descriptor = validated.value;
    if (observe !== null && typeof observe !== "function") {
      return { ok: false, status: 400 };
    }
    const path = "UICO." + descriptor.uiId;
    if (this.surfaces.has(descriptor.uiId) ||
        this.core.uru.objects.has(path)) {
      return { ok: false, status: 409 };
    }
    const object = {
      id: path,
      parentPath: "UICO",
      strictOCDA: true,
      authorization: Object.freeze({
        default: "Private",
        describe: "Public",
        getState: "Public"
      }),
      ocda: Object.freeze({
        Request: ["describe", "getState"],
        Response: ["describe", "getState"],
        UserAPI: ["describe", "getState"],
        AgentAPI: ["describe", "getState"],
        Property: ["UISP"],
        APIDescriptors: [
          apiDescriptor(path + ".describe", path, "describe", "read",
            "Read the registered native UI descriptor"),
          apiDescriptor(path + ".getState", path, "getState", "read",
            "Read the immutable UISP state projection")
        ],
        Program: "UICO.NativeUI",
        EHU: "LinkCore.OMU",
        Log: "LinkCore.OMU"
      }),
      receive: async action => {
        if (action === "describe") return descriptor;
        if (action === "getState") {
          if (!observe) return descriptor;
          const observed = UISP.validate({
            ...descriptor, geometry: observe()
          });
          if (!observed.ok) return failure(422, "Invalid native UI state");
          return observed.value;
        }
        return failure(404, "Unknown UI Object action");
      }
    };
    if (!this.core.register(object)) {
      return { ok: false, status: 409 };
    }
    this.surfaces.set(descriptor.uiId, descriptor);
    return { ok: true, status: 201, value: descriptor };
  }

  /**
   * One public, Hub-mediated protocol entry point. The authenticated
   * Object source is bound by HubUnit, never accepted from the envelope.
   */
  async dispatchUIRequest(request, context) {
    const parsed = UIProtocolPolicy.validateRequest(request);
    if (!parsed.ok) return failure(400, parsed.reason);
    const { action, payload } = parsed.value;
    const providerId = payload.providerId;
    const manifest = this.core.uru.getProvider(providerId);
    if (!manifest || manifest.objectId !== context.source ||
        !this.core.checkPluginPermission(providerId, parsed.capability)) {
      return failure(403, "UI capability not granted");
    }
    let output;
    let status = 200;
    if (action === "UI.Create" || action === "UI.OpenWindow") {
      if (action === "UI.OpenWindow" && payload.kind !== "window") {
        return failure(400, "Window kind required");
      }
      output = this.adapter.create(context.source, parsed.value);
      status = 201;
    } else if (action === "UI.List") {
      output = [
        ...this.surfaces.values(),
        ...[...this.adapter.nodes].filter(([, item]) =>
          item.owner === context.source).map(([uiId]) =>
          this.adapter.state(uiId, context.source))
      ];
    } else if (action === "UI.Describe" ||
        action === "UI.GetState") {
      if (this.surfaces.has(payload.uiId)) {
        const state = await this.core.request(
          "UICO", "UICO." + payload.uiId, "getState", {},
          { origin: "user" });
        if (!state.ok) return failure(state.status, "UI state unavailable");
        output = state.value;
      } else {
        output = this.adapter.state(payload.uiId, context.source);
      }
    } else if (action === "UI.GetProperty") {
      if (this.surfaces.has(payload.uiId)) {
        const state = this.surfaces.get(payload.uiId);
        if (!Object.hasOwn(state, payload.property)) {
          return failure(404, "UI property missing");
        }
        output = { uiId: payload.uiId, property: payload.property,
          value: state[payload.property] };
      } else {
        output = this.adapter.getProperty(payload.uiId,
          context.source, payload.property);
      }
    } else if (action === "UI.Update") {
      output = this.adapter.update(payload.uiId, context.source, {
        ...payload, expectedRevision: parsed.value.expectedRevision
      });
    } else if (action === "UI.Remove" ||
        action === "UI.CloseWindow") {
      output = this.adapter.remove(payload.uiId, context.source);
    } else if (action === "UI.SetVisibility") {
      output = this.adapter.setVisibility(
        payload.uiId, context.source, payload.visible);
    } else if (action === "UI.SetFocus") {
      output = this.adapter.focus(payload.uiId, context.source);
    } else if (action === "UI.AddTab") {
      output = this.adapter.addTab(payload.uiId, context.source,
        payload.tabId, payload.title);
    } else if (action === "UI.RemoveTab") {
      output = this.adapter.removeTab(payload.uiId, context.source,
        payload.tabId);
    } else if (action === "UI.NavigatePluginView") {
      output = this.adapter.navigate(payload.uiId, context.source,
        payload.viewId);
    } else if (action === "UI.Subscribe") {
      output = this.adapter.subscribe(payload.uiId, context.source,
        payload.subscriptionId);
    } else if (action === "UI.Unsubscribe") {
      output = this.adapter.unsubscribe(payload.uiId, context.source,
        payload.subscriptionId);
    } else {
      return failure(501, "UI operation not yet implemented");
    }
    const audit = this.core.omu.record("Log", context.source,
      action, status, "UICO", { requestId: request.requestId });
    return Object.freeze({
      requestId: request.requestId, eventId: audit?.eventId ?? 0,
      status, ok: true, data: output
    });
  }

  async receive(action, payload = {}, context = {}) {
    if (action === "describe") {
      return Object.freeze({
        objectId: this.id,
        protocol: UIProtocolPolicy.protocol,
        property: "UISP",
        propertyVersion: UISP.version,
        readOnly: true,
        extensionAPIOperations: UIExtensionAPIPolicy.operations
      });
    }
    if (action === "list") {
      if (payload !== null &&
          (typeof payload !== "object" || Array.isArray(payload))) {
        return failure(400, "Invalid UI query");
      }
      return Object.freeze([...this.surfaces.values()]);
    }
    if (action === "uiRequest") {
      return this.dispatchUIRequest(payload, context);
    }
    if (action !== "extensionAPI") {
      return failure(404, "Unsupported UICO action");
    }
    if (!payload || typeof payload !== "object" ||
        Array.isArray(payload)) return failure(400, "Invalid operation");
    const capability = PERMISSION[payload.operationCode];
    if (!capability) return failure(400, "Unknown UI operation code");
    const providerId = payload.providerId;
    const manifest = this.core.uru.getProvider(providerId);
    if (!manifest || manifest.objectId !== context.source ||
        !this.core.checkPluginPermission(providerId, capability)) {
      return failure(403, "UI extension permission denied");
    }
    const path = "UICO." + payload.uiId;
    if (!this.core.uru.objects.has(path) ||
        !this.surfaces.has(payload.uiId)) {
      return failure(404, "UI Object not registered");
    }
    const checked = this.core.uru.applyUIExtensionAPI(
      payload, { ownerId: context.source, authorized: true });
    if (!checked.ok) return failure(checked.status, "UI extension rejected");
    return Object.freeze({
      operationCode: payload.operationCode,
      uiId: payload.uiId,
      apiId: payload.apiId,
      entry: checked.value.entry,
      status: checked.status
    });
  }
}
