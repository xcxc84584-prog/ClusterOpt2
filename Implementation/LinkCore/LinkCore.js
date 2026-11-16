import { ParallelExecutionPolicy } from "../property/ParallelExecutionPolicy.js";
import { AccessPolicy } from "../property/AccessPolicy.js";
import { UnifiedRegistrationUnit } from "./UnifiedRegistrationUnit.js";
import { ObjectManagementUnit } from "./ObjectManagementUnit.js";
import { EntireDomainPropertyManagementUnit } from "./EntireDomainPropertyManagementUnit.js";
import { HubUnit } from "./HubUnit.js";

/** Stable LinkCore facade: all cross-object activity uses the HubUnit. */
export class LinkCore {
  constructor() {
    this.edpmu = new EntireDomainPropertyManagementUnit();
    this.uru = new UnifiedRegistrationUnit(this.edpmu);
    this.omu = new ObjectManagementUnit();
    this.hub = new HubUnit(this.uru, this.edpmu, this.omu);
    this.version = "0.0.1-pr1.patch6";
    this.hub.registerProperty("SystemVersion", this.version, {
      owners: ["LinkCore"], visibility: "Public"
    });
    this.hub.registerProperty("ParallelExecutionPolicy",
      ParallelExecutionPolicy, { owners: ["LinkCore"] });
    this.hub.registerProperty("AccessPolicy", AccessPolicy, {
      owners: ["LinkCore"]
    });
    this.hub.registerProperty("DocumentStatus", Object.freeze({
      SYNCED: "green", DIRTY: "yellow",
      ERROR: "red", LOADING: "blue"
    }), { owners: ["LinkCore"] });
  }

  register(object) { return this.hub.register(object); }
  unregister(id) { return this.hub.unregister(id); }
  request(source, target, action, payload = {}, options = {}) {
    return this.hub.request(source, target, action, payload, options);
  }
  readProperty(source, name) {
    return this.hub.readProperty(source, name);
  }

  subobjects(path) { return this.uru.subobjects(path); }
  inheritedProperties(path) { return this.edpmu.inheritedBy(path); }

  getSnapshot() {
    return {
      version: this.edpmu.get("SystemVersion"),
      objects: this.uru.list(),
      properties: this.edpmu.list(),
      ...this.omu.snapshot()
    };
  }
}

export const linkCore = new LinkCore();

if (typeof window !== "undefined") {
  const methods = Object.freeze({
    log: () => linkCore.getSnapshot().logs,
    objectlist: () => linkCore.getSnapshot().objects,
    propertylist: () => linkCore.getSnapshot().properties,
    rep: () => linkCore.getSnapshot().dependencies,
    subobject: (path) => linkCore.subobjects(path),
    inheritedProperties: (path) => linkCore.inheritedProperties(path),
    version: () => linkCore.getSnapshot().version
  });
  Object.defineProperty(window, "Cluster", {
    configurable: false, writable: false, value: methods
  });
}
