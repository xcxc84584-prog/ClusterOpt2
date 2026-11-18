# PR22.1 Patch(+1)

## Symptoms
Repeated `Plugin.Explorer.PermissionRejected` and
`Plugin.Explorer.RootRequired` while attempting ToolBox grants.

## Changed
- `Implementation/LinkCore/PluginUIHostUnit.js`:
  handle browser picker `prompt` with explicit requestPermission;
  enforce root selection before toggling a grant; validate Read;
  expose rejection reason and lock checkbox while asynchronous
  browser approval completes.
- `Implementation/e2e/pr14-explorer-toolbox.spec.js`:
  regression for missing root, prompted Read and ReadWrite grants.

## Validation
The new Playwright test is committed; CI and physical Windows
file-system/PS user acceptance remain to be confirmed.
`Plugin.LocalAgent.UnexpectedAction` is not yet resolved.

## Rollback
Revert this Draft PR, retaining existing merged main.
