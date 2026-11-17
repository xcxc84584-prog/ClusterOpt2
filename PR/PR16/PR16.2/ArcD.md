# PR16.2 Architecture
Isolated iframe srcdoc -> postMessage intent -> PluginUIHostUnit
  -> host-only PluginLocalAgentObject / PluginModelTaskObject
  -> HubUnit -> OMU EHU/Log.
CSP and sandbox allow-scripts isolation unchanged.
