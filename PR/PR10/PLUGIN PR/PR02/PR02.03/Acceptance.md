# PR02.03 — Property Descriptor Acceptance
## Deliverables
PropertyDescriptorPolicy, EDPMU metadata attachment, Hub registration,
Node/Chromium tests and CI, full PR documentation.
## Acceptance
- Validate bounded immutable type/owner/visibility/read/write/invariants.
- Reject wrong name/owner/visibility, unsafe metadata and duplicates.
- Confirm invalid register emits OMU EHU and no orphan entry.
- Preserve existing URU / EDPMU / HubUnit; read authorizations unchanged.
- Confirm browser loads, Node unit passes, regression workflows pass.
## Status
IMPLEMENTED / CI PENDING. Do not mark PASS without exact-head evidence.
