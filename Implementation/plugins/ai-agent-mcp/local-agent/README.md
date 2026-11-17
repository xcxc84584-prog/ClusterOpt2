# AI AGENT MCP(ChatGPT) — Windows Local Agent package

This directory vendors the **unchanged** Cluster legacy Node services.
Browser plugin install does not execute these local programs.

Prerequisites: Windows, PowerShell, Node.js 20+, npm, and a browser
supporting local WebSocket and File System Access where relevant.

In a user-controlled PowerShell window, from this directory run:

```powershell
.\Start-LocalAgent.ps1 -Origin 'https://xcxc84584-prog.github.io'
```

This starts the loopback Local Agent on port 43879. Enter its token
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

Never publish the agent port (43879), the MCP port (43880), a local
pairing token or bearer key. The OAuth gateway is scoped read-only;
its advertised five tools are not equivalent to unrestricted Explorer
or PowerShell control. Remote MCP may expose additional operations
behind independent local authorization; review before using.

The unchanged legacy Agent persists model credentials locally.
Encryption at rest is not verified; use a scoped key on a trusted
Windows account. Prefer changing this storage before production use.

The original local services must be explicitly started by the user.
No service is auto-installed, auto-started or silently upgraded.
