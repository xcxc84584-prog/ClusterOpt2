# PR14.9 ArcD

## Objects and dependencies
Existing PluginHostInstallUnit, PluginPackageStoreUnit and UI-host rollback cleanup

## EventChain
Install -> explicit review -> URU register -> UI mount -> disable/upgrade/uninstall -> runtime revoke -> rollback or replace; persisted package snapshots remain inert until review.

## Relation
Default 00. Only host-authorized source Object and user-approved
capabilities may initiate requests through HubUnit. Replies remain
bounded. OMU records all denials as EHU and successful events as Log.

## Error handling
400 invalid input; 403 denied capability; 404 missing target;
409 conflicting action; 413 size limit; 503 missing service;
504 timeout. No secret, full path or file contents in EHU.
