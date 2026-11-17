# PLUGIN PR02 — Patch(+3): Property Descriptor Schema
## Scope
Major PR 2, small PR 3. Preserve v0.0.9 editor/save paths.
## External design
VS Code configuration schema and Theia PreferenceSchemaService separate
description from runtime value and scoped authorization.
## Modified
- New property/PropertyDescriptorPolicy.js: bounded immutable v1 metadata.
- EDPMU stores optional validated descriptor in the existing record.
- LinkCore registers the validator through the existing Hub route.
- Node and browser acceptance tests; dedicated CI workflow.
- Updated PRD/Plan/ArcD/Relation/registry/handoff.
## EventChain and EHU
Hub register -> URU -> EDPMU -> 201 or EHU 400/413; no partial register.
EDPMU.describeProperty is internal metadata-only; real values still go
through HubUnit.readProperty/AccessPolicy.
## Safety and rollback
No direct File System Access, SaveTask, Provider loading, or route switch.
Rollback to backup/plugin-pr02-sub02-20261117 if checkpoint exists;
otherwise use exact PR02.02 commit
a7ba16a5859b0b428059cd71e5be401da6a637f9.
## Verification
Local source syntax / isolated validator smoke: PASS.
Full Node, Chromium, GitHub exact-head: PENDING until verified.
No merge to main.
