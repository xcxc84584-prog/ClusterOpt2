# AI AGENT MCP(ChatGPT) — Windows Local Agent package

This directory vendors Cluster legacy Node services. The plugin copy of\nserver.cjs contains one explicit PR14.7 adaptation: a separately\napproved PowerShell command no longer requires an already opened\nlegacy terminal session. The original Cluster repository stays unchanged.
Browser plugin install does not execute these local programs.

Prerequisites: Windows, PowerShell, Node.js 20+, npm, and a browser
supporting local WebSocket and File System Access where relevant.

In a user-controlled PowerShell window, from this directory run:

```powershell
.\Start-LocalAgent.ps1 -Origin 'https://xcxc84584-prog.github.io'
```

This starts the loopback Local Agent on port 43881. Enter its token
only into Cluster's trusted pairing dialogue. To start the optional
local MCP bearer gateway in another shell:

```powershell
.\Start-MCP.ps1
```

For OAuth, first configure and validate your **own trusted** HTTPS
reverse proxy to the loopback OAuth port; then start:

```powershell
.\Start-OAuth.ps1 -Issuer 'https://your-trusted-host.example'
```

Never publish the agent port (43881), the MCP port (43880), a local
pairing token or bearer key. The OAuth gateway is scoped read-only;
its advertised five tools are not equivalent to unrestricted Explorer
or PowerShell control. Remote MCP may expose additional operations
behind independent local authorization; review before using.

PR21.3 stores the pairing token and model provider credentials in
Windows DPAPI CurrentUser encrypted files (`pairing-token.dpapi` and
`ai-provider.dpapi`). On the first run, validated legacy plaintext files
are migrated and deleted after the encrypted replacement is written.
The token remains stable across restarts and changes on explicit revoke.
The Windows user profile must remain available for decrypting secrets.
Do not back up or sync these protected files expecting them to work
under a different Windows user account. Keep the machine profile secure.

The standalone Quick-Setup asks for confirmation, then starts the Local
Agent hidden under the current Windows account. It is not a machine-wide
Windows service and does not require administrator rights.
Use `Background-Agent.ps1 -Action Status` to query it,
`-Action Stop` to stop only the identity-verified process, and
`-Action Token` to display the protected pairing token locally.
Other MCP and OAuth services still need their own explicit setup.
No service is auto-installed or silently upgraded.

## Standalone MCP Quick Setup

Run `MCP-Quick-Setup.cmd` **after** Local Agent setup to download the
reviewed MCP/OAuth services and open their loopback consoles. For the
public ChatGPT connection, configure HTTPS termination separately and
supply the exact issuer origin in the OAuth console. The remote OAuth
scope `cluster.read` is server-enforced to five read-only tools.
See `../MCP-SETUP.md` for the full walkthrough and tool matrix.

Port selection for all three scripts uses the shared `Port-CPO.ps1` (C=cancel, P=choose another port, O=verified override with a second explicit confirmation). Selected ports are stored in `%LOCALAPPDATA%/ClusterOpt2/AI-Agent-MCP/service-ports.json`; use the actual OAuth port for HTTPS proxy routing and the actual Agent port for browser pairing. Default ports: Local Agent 43881, MCP 43880, OAuth 43879.


### PR21.4 background MCP / OAuth

The MCP Quick Setup CMD now downloads one pinned `Setup-MCP.ps1`
bootstrapper. It preserves the legacy Cluster `remote-mcp.cjs` and
`oauth-mcp-gateway.cjs` protocol implementations, reading the Local
Agent pairing credential through the existing Windows DPAPI vault.

Run `Background-Gateway.ps1 -Action Status` for local status. Explicit
`-Action StartMCP` starts the loopback MCP gateway. After it is running,
`-Action StartOAuth` optionally launches the legacy cloudflared quick
HTTPS tunnel and the OAuth loopback gateway without persistent CMD windows.
`-Action StopOAuth` stops the OAuth gateway and its verified tunnel,
then `-Action StopMCP` stops MCP. Neither command stops an unknown PID.

The ephemeral `trycloudflare.com` address changes when the tunnel is
restarted and requires updating the ChatGPT connection. For persistent
production use, configure a trusted fixed HTTPS reverse proxy and pass
`-Issuer https://your-hostname` to `-Action StartOAuth`. Only expose
the OAuth loopback port; never publish the MCP/terminal ports directly.
Do not copy bearer credentials into setup scripts or CI logs.
