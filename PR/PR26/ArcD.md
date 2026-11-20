# PR26 — Architecture / Event chain

## UI
Plugin Manager / API LIST
  -> category select + search field (single horizontal toolbar)
  -> HubUnit.discoverCatalog(page) -> LiveCatalogPage
  -> authorized summaries -> result table -> pagination footer
  -> click API -> authorized describeLive -> contract details

No template/download control on this path.

Resources
  -> full authorized API export -> LinkCore.exportLiveCatalog
  -> verified SHA-256 JSON file
  -> plugin template ZIP download -> live API export + deployed SDK .d.ts
  -> pluginTemplateFiles(Manifest, Worker, UI, docs, authorized catalog)
  -> bounded createTemplateZip -> browser download.

## Object / Property
No new URU/EDPMU registries or shared Property. Existing objects
HubUnit/OMU, catalog and plugin installer retain authority.
Generator is pure and does not obtain plugin execution permission.

## Event Chain / EHU
- Page search: User -> Plugin Manager -> HubUnit -> URU -> table.
- Template success: click -> authorized export -> fetched SDK ->
  ZIP generator -> download.
- Template fail: fetch/catalog version or ACL invalid -> no ZIP;
  user-visible Resources error; underlying Hub EHU remains authoritative.
- Plugin install: user selects extracted ZIP folder; Host applies
  Manifest validation and asks for explicit permission/RPC consent.

## VTE
Valid bilingual ZIP, SDK exact content and API-CATALOG integrity;
manifest acceptance, no unwanted API download controls, same-row
responsive search, complete export only in Resources, E2E links and
existing CI regression suite.
