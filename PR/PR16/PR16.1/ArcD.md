# PR16.1 Architecture
User -> AI Agent button -> PluginUIHostUnit -> PluginWorkbenchTabUnit
  -> #tabs .plugin-agent-tab <-> #workspace .plugin-extension-panel
User -> editor/plugin/PowerShell tab -> original host switch
  -> PluginWorkbenchTabUnit.deactivate (no editor business logic changed)
HubUnit/OMU/URU ownership unchanged.
EHU: legacy PluginUIHost installation errors via OMU.
New host adapter owns a disposable UI handle, not new permissions.
