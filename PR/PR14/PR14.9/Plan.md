# PR14.9 Plan

## Goal
Preserve plugin package lifecycle without preserving ephemeral system permissions

## Implementation
Existing PluginHostInstallUnit, PluginPackageStoreUnit and UI-host rollback cleanup

## Security and load
Folder handles, MCP switch, shell switch and pending approval never persist across disable/uninstall; no stored API key in package export; failed mount unregisters auxiliary OCDA Objects.

## Acceptance gate
Existing PR13 lifecycle VTE/Chromium plus PR14.9 reinstall and privilege revocation regression.
