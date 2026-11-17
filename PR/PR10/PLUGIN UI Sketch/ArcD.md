# Architecture

Plugin Manager shell → Sidebar (URU Providers) + Tabs (Permission / API / EHU / Performance)

- Permission → HubUnit grant / revoke through existing trusted consent UI
- API List → CatalogCollection.collect (URU Object APIDescriptors + EDPMU Property Descriptors), plus URU Provider Manifest provides and legacy EDPMU metadata
- API Detail → read-only descriptor JSON; never execute a Request
- EHU → OMU snapshot filtered to EHU events
- Performance → migrated existing settings DOM and original listeners
- Language → EDPMU Language; refresh on language change

## Event chains
Provider.Register → URU validation → registry update → API List render → detail
Property.Register → EDPMU update → API List render
Permission.Grant → consent → HubUnit enforcement → OMU

## EHU policy
Source: UI; target: HubUnit registry; failing read/registration is surfaced without granting privilege.

## Patch 2 architecture
Performance tab → inline max-text-size control → `main.js` validates integer 1–1024 → HubUnit Request (`slice-registry.setLimit`) → status. The legacy category controller and menu are deleted, not hidden. Existing null/unlimited configuration remains effective until a bounded value is explicitly applied. LanguageManager updates retained element IDs.

## Patch 3 — read-only UI adapters
Plugin Manager → Sidebar (URU Providers; searchable status terms; collapse)
→ Permission (existing HubUnit permissions)
→ API List (existing CatalogCollection + URU Provider Manifests + EDPMU property descriptors; ContractView renderer)
→ EHU (existing OMU event snapshot)
→ Resources (ResourceView: left legacy budget controls + JSON export tools; right Provider Manifest cards + searchable missing/available location metadata).

Export chain: User click → JSON serialization of UI-visible descriptors or selected EHU base fields → browser Blob → user download. No API execution, no privilege grant, no additional Registry. Plugin source links are not fabricated; current Manifest has no URL field.
