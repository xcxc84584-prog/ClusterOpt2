# PR14.9 Patch(+1)

Delivered on Draft PR #61 branch pr14/ai-agent-mcp-audit.
Existing PluginHostInstallUnit, PluginPackageStoreUnit and UI-host rollback cleanup

Security: Folder handles, MCP switch, shell switch and pending approval never persist across disable/uninstall; no stored API key in package export; failed mount unregisters auxiliary OCDA Objects.

Automated tests were added where supported; the following gate
must not be marked PASS without direct evidence: Existing PR13 lifecycle VTE/Chromium plus PR14.9 reinstall and privilege revocation regression.

No core application business logic changed and no release version bump.
