# PR26 — API LIST Layout & Complete Plugin Template

## PRD / goal
The API List is a discovery surface with only a category selector and
search input in one row, followed by a live contracts table and paging.
Template and export operations belong exclusively to Resources.

## Requirements
- Keep URU/EDPMU authoritative, HubUnit/ACL and revision semantics.
- Responsive single-line category + search on desktop and narrow viewports.
- Do not reset search focus/caret during live registry revision refresh.
- No download/template buttons or capability panel inside API List.
- Resources offers complete authorized API JSON (five live categories,
  SHA-256/revision) and a ZIP development scaffold with Manifest JSON,
  runnable Worker SDK handler, official .d.ts, Request/Response schema,
  Event/security guides and current authorized API-CATALOG.json.
- Do not invent unavailable API definitions or silently emit incomplete
  files when fetching SDK/catalog fails.
- Preserve legacy bundle import/export and existing plugin packages.
- Test Node/VTE, browser downloads, ZIP extraction, ACL and responsive UI.

## Security / load analysis
- API export through LinkCore.exportLiveCatalog and authorized describe
  (all five kinds, revision hash, max 64MiB); ZIP STORE bounded to
  48 entries and 68MiB content. No remote network or privilege granted.
- The downloaded ZIP is inert until user consents and mounts a folder.
- Never store keys/absolute paths and never execute downloaded templates
  during generation.

## Reference patterns
- Carbon Design System data table toolbar: compact filter/search above
  data table; operations separated from lookup.
- Kong Konnect API List: list rows link to complete API documentation.

## SOP
PRD -> Plan -> ArcD -> Implementation + Relation Test -> Project.
