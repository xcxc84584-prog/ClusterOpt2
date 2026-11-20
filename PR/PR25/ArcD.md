# PR25 — Architecture and event chain

```text
Plugin Manager UI
    -> Cluster.api.page / describeLive (browser facade)
       -> HubUnit.discoverCatalog (caller identity, audit)
          -> LiveCatalogPage (registered metadata only)
             -> URU Object APIDescriptors + EDPMU Property descriptors
             -> CatalogVisibilityPolicy / AccessPolicy
          -> OMU Log / EHU
    -> LinkCore.verifyStaticCatalog (trusted host only)
       -> CatalogStaticGuard -> URU -> OMU EHU(code,file,line)
```

## Objects and properties
No additional EDPMU global Property and no second registry.
LinkCore helpers: LiveCatalogPage and CatalogStaticGuard.

## Event chains
- Page PASS: UI -> HubUnit -> LiveCatalogPage -> URU/EDPMU -> OMU Log.
- Page FAIL: invalid origin/source -> HubUnit -> OMU EHU.
- Cursor race: page -> changed snapshotRevision -> HTTP 409,
  EHU code CATALOG_REVISION_MISMATCH.
- Static mismatch: trusted host manifest -> CatalogStaticGuard
  -> URU descriptor compare -> EHU CATALOG_VERSION_MISMATCH,
  target owner, source file and source line.
- API describe: UI -> HubUnit -> ACL -> one registered descriptor.

## VTE checks
Page 100/1000/10000; duplicate/missing record; ACL filtering;
source-side search; stale cursor 409; static version failure EHU;
no exposure of property values; invalid paths; failure retention.
Pending: browser E2E, CI, full exporter, real Worker blind test.

## Patch(+5): Authoritative Event/Export/Static source chains

```text
EDPMU.PluginLifecycleEventPolicy (read-only)
   -> LiveCatalogPage.Event -> HubUnit -> API LIST
Actual Worker Session hello/suspended -> notifySession(state)
Actual plugin-owned UI click -> UICO Adapter.subscribe -> UICO Request
   -> owner Object action

Plugin Manager full export
   -> LiveCatalogPage.page for each of five categories
   -> LiveCatalogPage.describe (same ACL for each descriptor)
   -> verify all counts and snapshot revisions
   -> SHA-256 -> verify again -> atomic JSON download
   -> mismatch: OMU EHU 409, no partial export

CI source auditor (trusted build only)
   -> registered URU UICO / EDPMU Protocol / EDPMU Event declarations
   -> check explicit relative source file and version line
   -> verify actual Worker/UI subscription trigger symbol
   -> failure: OMU EHU(code,owner,id,file,line), CI exit != 0
```

### Security / lifecycle
No additional runtime command capability. Event Policy is an inert EDPMU
Property and does not itself trigger or subscribe to anything.
A plugin must still pass Session, exact rpcScopes, permission grant,
URUs exposed action list and Hub ACL. A Revision mismatch invalidates
cursor/export rather than returning partially stale authorized data.

### VTE proof
Negative ACL revocation during export; stale cursor 409; static
version/trigger mismatch with EHU file/line; 100/1000/10000 pages;
real Worker SDK docs-only package install, Session ready, request,
uninstall; API LIST in-place registration change and search retention.
