import { ParallelExecutionPolicy } from "../property/ParallelExecutionPolicy.js";
import { Language } from "../property/Language.js";
import { StoragePriority } from "../property/StoragePriority.js";
import { EditorInteractionPolicy } from "../property/EditorInteractionPolicy.js";
import { EditorViewportPolicy } from "../property/EditorViewportPolicy.js";
import { SliceBudgetPolicy } from "../property/SliceBudgetPolicy.js";
import { ToolTabPolicy } from "../property/ToolTabPolicy.js";
import { ViewportSlicePolicy } from "../property/ViewportSlicePolicy.js";
import { LineAddressPolicy } from "../property/LineAddressPolicy.js";
import { ViewportLinePolicy } from "../property/ViewportLinePolicy.js";
import { SliceTransactionPolicy } from "../property/SliceTransactionPolicy.js";
import { SliceJournalPolicy } from "../property/SliceJournalPolicy.js";
import { SliceFileWritePolicy } from "../property/SliceFileWritePolicy.js";
import { VirtualDocumentPolicy } from "../property/VirtualDocumentPolicy.js";
import { UTF8SlicePolicy } from "../property/UTF8SlicePolicy.js";
import { PieceTreePolicy } from "../property/PieceTreePolicy.js";
import { BPlusSliceIndex } from "../property/BPlusSliceIndex.js";
import { UI_COLOR } from "../property/UI_COLOR.js";
import { FileManagement } from "../property/FileManagement.js";
import { RecoveryPolicy } from "../property/RecoveryPolicy.js";
import { FileTypePolicy } from "../property/FileTypePolicy.js";
import { ExplorerOrderPolicy } from "../property/ExplorerOrderPolicy.js";
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
    this.version = "0.0.8-pr8.patch18";
    this.hub.registerProperty("SystemVersion", this.version, {
      owners: ["LinkCore"], visibility: "Public"
    });
    this.hub.registerProperty("ParallelExecutionPolicy",
      ParallelExecutionPolicy, { owners: ["LinkCore"] });
    this.hub.registerProperty("AccessPolicy", AccessPolicy, {
      owners: ["LinkCore"]
    });
    this.hub.registerProperty("UI_COLOR", [...UI_COLOR.defaultRGB], {
      owners: ["LinkCore", "InterfacePalette"], visibility: "Public"
    });
    this.hub.registerProperty("Language", Language.defaultLocale, {
      owners: ["LinkCore", "LanguageManager"], visibility: "Public"
    });
    this.hub.registerProperty("StoragePriority", StoragePriority.defaultValue, {
      owners: ["LinkCore", "workspace"], visibility: "Public"
    });
    this.hub.registerProperty("PieceTreePolicy", PieceTreePolicy,
      { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("BPlusSliceIndex", BPlusSliceIndex,
      { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("UTF8SlicePolicy", UTF8SlicePolicy,
      { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("VirtualDocumentPolicy",
      VirtualDocumentPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("SliceFileWritePolicy",
      SliceFileWritePolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("SliceJournalPolicy",
      SliceJournalPolicy, { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("SliceTransactionPolicy",
      SliceTransactionPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("ViewportLinePolicy", ViewportLinePolicy,
      { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("LineAddressPolicy", LineAddressPolicy,
      { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("ViewportSlicePolicy", ViewportSlicePolicy,
      { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("ToolTabPolicy", ToolTabPolicy,
      { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("SliceBudgetPolicy",
      SliceBudgetPolicy, { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("EditorViewportPolicy",
      EditorViewportPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("EditorInteractionPolicy",
      EditorInteractionPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("ExplorerOrderPolicy",
      ExplorerOrderPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("FileTypePolicy", FileTypePolicy, {
      owners: ["LinkCore"], visibility: "Public"
    });
    this.hub.registerProperty("BlockedFileTypes",
      [...FileTypePolicy.defaults], {
        owners: ["LinkCore", "file-types"], visibility: "Public"
      });
    this.hub.registerProperty("RecoveryPolicy", RecoveryPolicy, {
      owners: ["LinkCore"], visibility: "Public"
    });
    this.hub.registerProperty("FileManagement", FileManagement, {
      owners: ["LinkCore"], visibility: "Public"
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
