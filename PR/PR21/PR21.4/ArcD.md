# PR21.4 ArcD — Existing Object/Property compatibility
## Existing contract
No new global Property or HubUnit route; retain URU/EDPMU/OMU single authority. Existing PluginLocalAgentObject network pairing, PluginUIHostUnit, PluginMCPReadOnlyObject, PluginShellApprovalObject, and server.cjs carry their existing contracts.

## Data flow
1. User -> CMD (explicit) -> Setup-MCP.ps1 (pinned Git source) -> %LOCALAPPDATA% current-user scripts.
2. Background-Gateway.ps1 StartMCP -> remote-mcp.cjs -> DPAPI-protected pairing -> Local Agent 43881 -> browser ToolBox.
3. Explicit StartOAuth -> cloudflared HTTPS (legacy path) -> oauth-mcp-gateway.cjs loopback 43879 -> authenticated remote-mcp.cjs loopback 43880.
4. Browser host PluginUIHostUnit -> TrustedPairingVault (encrypted IndexedDB); iframe receives only savedPairing:boolean and state; UI button sends cluster-local-agent-use-saved -> host stageHostPairing() -> HubUnit request("pair").
5. StopOAuth / StopMCP requires validated process fingerprint and port ownership; never blindly kill another listener.

## Event/EHU
- Pair on HubUnit remains user-origin Request/Response.
- Native startup failures logged to installer stderr and local logs, not a new Hub object.
- ToolBox-denied operations retain existing OMU EHU and independent approval.
- Dynamic cloudflared URL can change after process restart; user must reconfigure ChatGPT connector.
