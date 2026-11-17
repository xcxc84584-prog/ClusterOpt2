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

## Patch 3 — Resource / Contract Explorer
- Remove Plugin List select filter; search terms now also match Enabled/Disabled status, owner, service, version, and permissions.
- Collapsible 39px sidebar retaining the toggle on the collapsed edge.
- Expand API List into a read-only contract explorer with nested Input/Output Schema, Property invariants, metadata, and raw JSON.
- Rename Performance to Resources, show independent scrolling panes (left budget/exports, right searchable installed-provider package-path cards).
- Export public-view API snapshot, limited-field EHU JSON and Provider Manifest JSON on user request.
- Manifest schema contains no package download URL; show absence explicitly rather than inventing installable packages.
- UI language through existing EDPMU Language; styles through UI_COLOR palette tokens.
- No new LinkCore, Object, global Property, or HubUnit mutation.
