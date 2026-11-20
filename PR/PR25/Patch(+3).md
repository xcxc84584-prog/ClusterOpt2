# PR25 Patch(+3) — E2E, revision refresh, source audit

## Changes
- Reconciled browser E2E with Service filtering, localized headings and new facade.
- Added browser tests for cursor paging, search, sorting, lazy descriptor and full export.
- Sort and schema search execute at the registered data source.
- The existing refresh callback checks live catalog revision without destroying UI inputs.
- CI runs static source version audit with EHU file/line diagnostics.
- Service discovery applies owner action ACL before catalog projection.
- Read-only contract inspection reports PASS/FAIL and OMU EHU.
- UICO public RPC descriptors explicitly state PluginPublic.
- Full Service export now includes declared permissions.

## Remaining
- Unannotated static descriptors lack source-line audit.
- Full Event payload inventory and real VTE UI are still missing.
- Independent third-party documentation-only blind study is pending.
- Merge only after final exact SHA full CI, E2E and acceptance.
