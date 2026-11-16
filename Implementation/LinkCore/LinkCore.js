import { ParallelExecutionPolicy } from "../property/ParallelExecutionPolicy.js";
import { AccessPolicy } from "../property/AccessPolicy.js";
import { UnifiedRegistrationUnit } from "./UnifiedRegistrationUnit.js";
import { ObjectManagementUnit } from "./ObjectManagementUnit.js";
import { EntireDomainPropertyManagementUnit } from "./EntireDomainPropertyManagementUnit.js";
import { HubUnit } from "./HubUnit.js";

/** Stable LinkCore facade: all cross-object activity uses the HubUnit. */
export class LinkCore {
  constructor() {
    this.uru = new UnifiedRegistrationUnit();
    this.omu = new ObjectManagementUnit();
    this.edpmu = new EntireDomainPropertyManagementUnit();
    this.hub = new HubUnit(this.uru, this.edpmu, this.omu);
    this.version = "0.0.1-pr1.patch4";
    this.edpmu.register("SystemVersion", this.version);
    this.edpmu.register("ParallelExecutionPolicy", ParallelExecutionPolicy);
    this.edpmu.register("AccessPolicy", AccessPolicy);
    this.edpmu.register("DocumentStatus", Object.freeze({
      SYNCED: "green", DIRTY: "yellow",
      ERROR: "red", LOADING: "blue"
    }));
  }

  register(object) { return this.hub.register(object); }
  unregister(id) { return this.hub.unregister(id); }
  request(source, target, action, payload = {}) {
    return this.hub.request(source, target, action, payload);
  }
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
    version: () => linkCore.getSnapshot().version
  });
  Object.defineProperty(window, "Cluster", {
    configurable: false, writable: false, value: methods
  });
}
