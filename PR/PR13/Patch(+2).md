# PR13 Patch(+2) — PR13.2/13.3/13.4 foundations

## Implemented
- PluginLocalPackageUnit: explicit user-selected directory handles;
  bounded package JSON / entry source read; no evaluation or URU mutation.
- PluginRPCContractPolicy: PluginMessagePolicy-backed data envelopes,
  request ID binding, manifest service/action match, strict response shape.
- PluginCapabilityReviewPolicy: deny unapproved / unsupported / Core
  permissions, no actual grant authority.
- LinkCore host-only staging entry and read-only EDPMU policies.
- Unit/VTE tests for intake, failure EHU, RPC mismatch and permission denial.

## Status
Partial implementation; not yet an executable third-party plugin feature.
- PR13.2 requires UI picker wiring and transactional activation.
- PR13.3 requires true untrusted-code isolation and authenticated bridge.
- PR13.4 requires host-origin approval ceremony and invocation-time ACL.
Do not claim full PASS before browser isolation and threat-model tests.

## Rollback
Revert PR13 draft branch to prior commit; main remains unchanged.
Backup baseline: backup/pr13-prestart-20261117.
