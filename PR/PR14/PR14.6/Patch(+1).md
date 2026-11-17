# PR14.6 Patch(+1) — ToolBox directory grant
- Added PluginExplorerObject host-scoped file CRUD with independent
  OFF-by-default grants, bounded operations and OMU audit.
- Added host-rendered ToolBox to AI AGENT upper-right corner.
- Native folder picker obtains browser read grant, then prompts
  for an absolute path label and checks its final folder name.
- Full path remains host-only; plugin receives only folderName and
  allowed operation results. Absolute path input alone grants nothing.
- PowerShell remains disabled pending PR14.7.
- Added node/VTE test for scoped permissions, CRUD, traversal,
  revocation and UI confirmation source.
- Status: code committed to PR14 Draft branch; Chromium/CI not yet
  confirmed at this checkpoint. Main unchanged.
