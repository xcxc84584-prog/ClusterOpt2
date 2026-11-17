import { CatalogCollection } from "./CatalogCollection.js";
import { CatalogQuery } from "./CatalogQuery.js";
import { CatalogVisibilityPolicy } from
  "../property/CatalogVisibilityPolicy.js";
import { CatalogVersionPolicy } from
  "../property/CatalogVersionPolicy.js";
import { CatalogDocumentation } from
  "../property/CatalogDocumentation.js";
import { PropertyDescriptorPolicy } from
  "../property/PropertyDescriptorPolicy.js";
import { APIDescriptorPolicy } from
  "../property/APIDescriptorPolicy.js";
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
import { GoToLinePolicy } from "../property/GoToLinePolicy.js";
import { GlobalPageLinePolicy } from
  "../property/GlobalPageLinePolicy.js";
import { SliceTransactionPolicy } from "../property/SliceTransactionPolicy.js";
import { SliceJournalPolicy } from "../property/SliceJournalPolicy.js";
import { SliceFileWritePolicy } from "../property/SliceFileWritePolicy.js";
import { SliceBatchWritePolicy } from "../property/SliceBatchWritePolicy.js";
import { VirtualDocumentPolicy } from "../property/VirtualDocumentPolicy.js";
import { DocumentSliceContract } from "../property/DocumentSliceContract.js";
import { VirtualPageLinePolicy } from "../property/VirtualPageLinePolicy.js";
import { UTF8SlicePolicy } from "../property/UTF8SlicePolicy.js";
import { PieceTreePolicy } from "../property/PieceTreePolicy.js";
import { BPlusSliceIndex } from "../property/BPlusSliceIndex.js";
import { UI_COLOR } from "../property/UI_COLOR.js";
import { FileManagement } from "../property/FileManagement.js";
import { RecoveryPolicy } from "../property/RecoveryPolicy.js";
import { FileTypePolicy } from "../property/FileTypePolicy.js";
import { ExplorerOrderPolicy } from "../property/ExplorerOrderPolicy.js";
import { ExplorerEntryPolicy } from "../property/ExplorerEntryPolicy.js";
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
    this.catalog = new CatalogCollection(this.uru, this.edpmu);
    this.hub = new HubUnit(this.uru, this.edpmu, this.omu,
      undefined, this.catalog);
    this.catalogQuery = new CatalogQuery(this.catalog);
    this.version = "0.0.9-pr9.patch9";
    this.hub.registerProperty("CatalogDocumentation",
      CatalogDocumentation, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("CatalogVersionPolicy",
      CatalogVersionPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("CatalogVisibilityPolicy",
      CatalogVisibilityPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("PropertyDescriptorPolicy",
      PropertyDescriptorPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("APIDescriptorPolicy", APIDescriptorPolicy, {
      owners: ["LinkCore"], visibility: "Public"
    });
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
    this.hub.registerProperty("VirtualPageLinePolicy",
      VirtualPageLinePolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("DocumentSliceContract",
      DocumentSliceContract, { owners: ["LinkCore"], visibility: "Public" });
    this.hub.registerProperty("VirtualDocumentPolicy",
      VirtualDocumentPolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("SliceBatchWritePolicy",
      SliceBatchWritePolicy, {
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
    this.hub.registerProperty("GlobalPageLinePolicy",
      GlobalPageLinePolicy, {
        owners: ["LinkCore"], visibility: "Public"
      });
    this.hub.registerProperty("GoToLinePolicy", GoToLinePolicy,
      { owners: ["LinkCore"], visibility: "Public" });
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
    this.hub.registerProperty("ExplorerEntryPolicy",
      ExplorerEntryPolicy, { owners: ["LinkCore"], visibility: "Public" });
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
  generateCatalogDocs(source, format, options = {}) {
    const result = CatalogDocumentation.render(
      (caller, command, kind, selector, context) =>
        this.hub.discoverCatalog(caller, command, kind, selector, context),
      source, format, options);
    // Pure rendering has no OMU access. Record failed public boundary
    // operations here without changing authorization or exposing content.
    if (!result.ok) {
      this.omu.record("EHU", source ?? "unknown", "Catalog.Document",
        result.status, format ?? "");
    }
    return result;
  }
  discover(source, command, kind, selector = {}, options = {}) {
    return this.hub.discoverCatalog(source, command, kind,
      selector, options);
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
