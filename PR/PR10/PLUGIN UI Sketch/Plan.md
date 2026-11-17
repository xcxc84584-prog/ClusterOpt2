# Plugin Manager sketch layout — Plan

## Requirement
- Left Plugin List and four right tabs: Permission, API List, EHU Log, Performance
- Independent scrolling, compact responsive layout, palette styling
- Dynamic bilingual UI derived from EDPMU Language
- API List exposes read-only HubUnit-connected URU/EDPMU contract metadata, including newly registered Provider Manifests

## Security
API discovery must never invoke operations or grant permission. Hide Private descriptors; runtime HubUnit ACL remains authoritative. External installation remains disabled.

## Load
Registry snapshot is rebuilt when the UI renders; maximum registry size is capped by CatalogCollection. Rendering should be paginated in a subsequent optimization if several thousand API entries occur.
