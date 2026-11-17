# PR13 Patch(+4) — HubUnit API List and reviewed-plugin restore

## Delivered
- API List uses a compact, scrollable six-column table instead of
  individual large cards.
- Request input and Response output are derived exclusively from
  declared APIDescriptor / Provider Contract schemas.
- HubUnit.listProviderContracts is a bounded, read-only projection over
  URU (no extra provider registry). It validates caller identity,
  filters disabled/missing Providers and records Log/EHU.
- UI fetches API + Property descriptors through HubUnit.discoverCatalog;
  it fetches Provider contracts through HubUnit.listProviderContracts.
- API detail shows the actual HubUnit Request/Response envelope shape
  alongside the registered payload/value schema.
- CSS uses shared UI palette properties.
- PR13.8 stores reviewed built-in provider preference separately from
  untrusted plugin package bytes (IndexedDB schema version 2).
- On reload, only vetted shipped plugin modules can auto-restore.
  Untrusted user-authored folder code stays inactive and unapproved.
- Bundle export includes reviewed provider IDs and enabled state.
- Bundle import validates allowlisted reviewed IDs and restores reviewed
  providers, while user packages remain inert.
- Reviewed enable/disable/uninstall operations synchronize preference
  storage; no parallel runtime identity state.
- VTE tests cover Provider contract schemas, caller validation, disable.
- Playwright covers table structure and reviewed-provider reload.

## EHU and Security
- Provider.Contract.List: unknown caller 404 EHU, invalid page 400 EHU.
- Provider.Contract.List: successful read 200 Log.
- Reviewed module loading only from shipped vetted source, not import
  archive script strings.
- Session permission grants are not persisted.
- Exported untrusted bundle snapshots are data only, not an approval.
- In-flight browser CI and sandbox security gates must pass before
  declaring PR13 completed.

## Limitations
- User-authored plugins still require PR13.3 sandbox and authenticated
  RPC bridge plus PR13.4 invocation-time HubUnit ACL.
- Generic HTML/CSS/JS project folders are preserved, not executed.
- Reviewed provider restoration uses only available built-in modules,
  not arbitrary package code or third-party remote URLs.

## Rollback
Draft #58 branch pr13/dynamic-plugin-manifest.
Baseline backup/pr13-prestart-20261117 remains recoverable.
