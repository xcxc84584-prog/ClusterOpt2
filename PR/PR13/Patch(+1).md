# PR13 Patch(+1) — PR13.1

## Implemented
- PluginPackageManifestPolicy parses user JSON with bounded bytes.
- Requires existing ProviderManifestPolicy and worker isolation.
- Blocks unsafe entry paths and unexpected top-level fields.
- Registers one read-only property through existing HubUnit/EDPMU.
- Adds Node regression tests and VTE non-registration assertion.
- No UI changes, dynamic import, runtime plugin execution or approvals.

## Remaining
PR13.2–PR13.8 are unimplemented. Dynamic runtime installation is not
claimed from this validation-only patch. The latest OCDA handoff and
browser tests must be confirmed before the next implementation.
