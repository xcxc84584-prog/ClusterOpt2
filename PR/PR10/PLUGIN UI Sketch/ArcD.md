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
