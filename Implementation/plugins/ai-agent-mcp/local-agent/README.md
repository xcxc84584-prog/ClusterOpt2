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

The unchanged legacy Agent persists model credentials locally.
Encryption at rest is not verified; use a scoped key on a trusted
Windows account. Prefer changing this storage before production use.

The original local services must be explicitly started by the user.
No service is auto-installed, auto-started or silently upgraded.

## Standalone MCP Quick Setup

Run `MCP-Quick-Setup.cmd` **after** Local Agent setup to download the
reviewed MCP/OAuth services and open their loopback consoles. For the
public ChatGPT connection, configure HTTPS termination separately and
supply the exact issuer origin in the OAuth console. The remote OAuth
scope `cluster.read` is server-enforced to five read-only tools.
See `../MCP-SETUP.md` for the full walkthrough and tool matrix.

Port selection for all three scripts uses the shared `Port-CPO.ps1` (C=cancel, P=choose another port, O=verified override with a second explicit confirmation). Selected ports are stored in `%LOCALAPPDATA%/ClusterOpt2/AI-Agent-MCP/service-ports.json`; use the actual OAuth port for HTTPS proxy routing and the actual Agent port for browser pairing. Default ports: Local Agent 43881, MCP 43880, OAuth 43879.
