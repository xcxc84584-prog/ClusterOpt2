# AI AGENT MCP(ChatGPT) — Quick configuration (Windows)

## Downloads
In ClusterOpt2, install `AI AGENT MCP(ChatGPT)` as a plugin. Open the AI Agent tab:
1. Download **Quick-Setup.cmd** and run it to install/start the local Agent. Pair in the trusted host dialog.
2. Download **MCP Quick Setup CMD**. This second, standalone file installs the MCP gateway scripts from a fixed reviewed Git commit, starts the loopback MCP gateway, and optionally starts OAuth.
3. Keep the created Agent, MCP and OAuth console windows open while in use. Do not launch the CMD as administrator.

## Ports and security
| Service | Loopback | Purpose |
| --- | --- | --- |
| Local Agent | 127.0.0.1:43879 (configurable) | Pairing, browser ToolBox and native PowerShell execution |
| MCP bearer gateway | 127.0.0.1:43880 | Internal MCP protocol; **never** publish directly |
| OAuth gateway | 127.0.0.1:43881 | Only gateway allowed behind a user-controlled HTTPS reverse proxy |

The setup scripts will not automatically set up a public tunnel. Configure a stable HTTPS hostname and point it **only** to `http://127.0.0.1:43881`. The public hostname must exactly match the OAuth issuer you supplied to the CMD, for example `https://mcp.example.com`. Test it via `https://mcp.example.com/.well-known/oauth-authorization-server`.

## ChatGPT connection
Open ChatGPT Settings → Plugins / custom MCP server (labels vary by client).
- Server endpoint: `https://YOUR_HTTPS_HOST/mcp`
- Authentication: OAuth
- Sign in via the OAuth page opened by ChatGPT.
- The gateway shows the local approval password file path in its own console. Read the password locally and enter it only on the approval page; never paste the password into ChatGPT conversation messages.
- Complete authorization and verify `cluster.get_status` and `cluster.list_files`.

## API scope and legacy parity
The legacy local `remote-mcp.cjs` exposes 14 tools:
`get_status`, `get_task_status`, `list_files`, `get_editor_state`,
`read_file`, `list_roots`, `find_root_windows_path`,
`list_directory`, `read_path`, `create_file`, `write_path`,
`delete_path`, `open_powershell`, `powershell_request`
(all names prefixed `cluster.`).

The local stdio transport now advertises the same 14 names. Local access is still restricted by browser ToolBox permissions and per-command PowerShell confirmation. Listing a tool never grants access.

**OAuth scope `cluster.read` exposes exactly five read-only tools**, and now filters the tool listing and rejects all other calls server-side:
`cluster.get_status`, `cluster.get_task_status`,
`cluster.list_files`, `cluster.get_editor_state`,
`cluster.read_file`.

Remote OAuth file modification and PowerShell execution are **not enabled** by this scope. A future `cluster.control` scope would require a separate grant, explicit UI consent, robust authorization tests and production security review. It must never be silently enabled by the read-only connection.

## Troubleshooting
- 43879 busy: use the Local Agent P/C/O prompt, but inspect the owner before consenting to O. MCP/OAuth busy ports are never forcibly cleared.
- 401 Unauthorized: recheck OAuth approval, expiry and the HTTPS issuer/callback origin.
- 503 Browser bridge disconnected: open ClusterOpt2, pair the Local Agent, and grant the relevant ToolBox permissions.
- 404 or connection refused: check each console and the reverse proxy to 43881.
- HTTPS issuer invalid: only an HTTPS origin with no path or trailing slash is accepted.
- Real Windows + OAuth end-to-end validation is required before production use.
