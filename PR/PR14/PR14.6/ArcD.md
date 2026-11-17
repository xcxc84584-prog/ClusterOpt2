# PR14.6 — ArcD
## Objects
- PluginExplorerObject: host-only directory handle, action-level ACL,
  bounded file operations and OMU EHU/Log.
- PluginUIHostUnit: existing generic host mount; ToolBox and native
  picker integration limited to the AI AGENT provider ID.
No new global property, no modifications to HubUnit/URU/EDPMU.
## EventChain
1. User > host ToolBox > native folder picker > browser read permission
   > absolute-path confirmation > PluginExplorerObject.setRoot.
2. User > host ToolBox > named grant toggle > browser write permission
   if requested > PluginExplorerObject.setRight.
3. Plugin iframe > authenticated source check in host >
   HubUnit.request(ui, PluginExplorerObject, action) >
   action-level ACL > browser handle > Hub Response > iframe.
4. Revoke, disable, uninstall > PluginExplorerObject.revoke.
## Relation
UI to PluginExplorerObject: 11 (only registered actions).
Plugin iframe to browser filesystem: 00.
Model/Worker to raw filesystem handle: 00.
PowerShell to PluginExplorerObject: 00 until PR14.7.
## EHU
400 invalid path/input; 403 denied scope/browser permission;
404 missing entry; 409 overwrite attempt; 413 data budget;
500 unexpected filesystem failure. Successful operations carry
bounded metadata only, not file content or full local path.
## Risk
A typed absolute path cannot be independently verified by browser
File System Access APIs. The browser-selected handle is authoritative.
