import { UISP } from "../property/UISP.js";
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
    this.extensions = new Map();
    this.authorization = Object.freeze({
      default: "Private",
      describe: "Public",
      list: "Public",
      extensionAPI: "Public"
    });
    this.ocda = Object.freeze({
      Request: Object.freeze(["describe", "list", "extensionAPI"]),
      Response: Object.freeze(["describe", "list", "extensionAPI"]),
      UserAPI: Object.freeze(["describe", "list", "extensionAPI"]),
      AgentAPI: Object.freeze(["describe", "list", "extensionAPI"]),
      Property: Object.freeze(["UISP"]),
      APIDescriptors: Object.freeze([
        apiDescriptor("UICO.describe", "UICO", "describe", "read",
          "Read host UI protocol identity and supported operations"),
        apiDescriptor("UICO.list", "UICO", "list", "read",
          "List registered UISP host UI surfaces"),
        apiDescriptor("UICO.extensionAPI", "UICO", "extensionAPI", "write",
          "Permission-scoped 2-bit plugin API extension operation")
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
  registerHostSurface(candidate) {
    const validated = UISP.validate(candidate);
    if (!validated.ok) return { ok: false, status: 400 };
    const descriptor = validated.value;
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
        if (action === "describe" || action === "getState") {
          return descriptor;
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
    const checked = UIExtensionAPIPolicy.transition(
      this.extensions, payload,
      { ownerId: context.source, authorized: true });
    if (!checked.ok) return failure(checked.status, "UI extension rejected");
    this.extensions = checked.value.state;
    return Object.freeze({
      operationCode: payload.operationCode,
      uiId: payload.uiId,
      apiId: payload.apiId,
      entry: checked.value.entry,
      status: checked.status
    });
  }
}
