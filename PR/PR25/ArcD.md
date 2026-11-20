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
