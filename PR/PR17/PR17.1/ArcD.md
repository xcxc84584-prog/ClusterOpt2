# PR17.1 — Architecture / Event Flow

AI Agent iframe -> cluster-plugin-quick-setup -> PluginUIHostUnit
-> downloadAgentQuickSetup -> browser downloads single CMD
-> user explicitly runs CMD and confirms
-> revision-pinned Setup-Quick.ps1 (downloaded)
-> Ensure-Node -> Ensure-Files -> Select-Port [P/C/O]
-> npm install -> node-pty runtime check + optional approval
-> server.cjs on 127.0.0.1:selectedPort
-> trusted PluginLocalAgentObject.askToken(token, port)
-> PluginLocalAgentPolicy.addressForPort(port) -> WebSocket

EHU: plugin-host download failures reported in OMU; pairing failures
continue through existing Local Agent EHU paths. Native CMD is external
to browser and must not be automatically executed.
No new OCDA Objects or global Properties.
