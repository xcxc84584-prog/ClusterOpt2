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

## Patch 2 — Minimal Performance
Remove header/title, redundant Plugin Tool toggle, legacy plugin category and unlimited controls. Keep only one line: maximum text load (1–1024 MiB), Apply and concise status. Preserve internationalization, scrolling, HubUnit behavior and palette styling. Reference VS Code Sidebar UX guidance: avoid duplicated functionality and excessive views.
