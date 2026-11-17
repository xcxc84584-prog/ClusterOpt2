# PR16.4 Architecture
Host ToolBox -> PluginExplorerObject (file permissions)
  -> PluginShellApprovalObject (command-by-command confirmation)
  -> PluginMCPReadOnlyObject (read-only bridge)
  -> PluginLocalAgentObject -> HubUnit / OMU.
