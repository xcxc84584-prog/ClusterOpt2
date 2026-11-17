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

Remote OAuth file modification and PowerShell execution are **not enabled** by `cluster.read`. The separately requested `cluster.control` scope requires explicit approval, and all operations still pass ToolBox and PowerShell checks.

## Troubleshooting
- 43879 busy: use the Local Agent P/C/O prompt, but inspect the owner before consenting to O. MCP/OAuth busy ports are never forcibly cleared.
- 401 Unauthorized: recheck OAuth approval, expiry and the HTTPS issuer/callback origin.
- 503 Browser bridge disconnected: open ClusterOpt2, pair the Local Agent, and grant the relevant ToolBox permissions.
- 404 or connection refused: check each console and the reverse proxy to 43881.
- HTTPS issuer invalid: only an HTTPS origin with no path or trailing slash is accepted.
- Real Windows + OAuth end-to-end validation is required before production use.

## Separate remote control authorization (PR20.1 Patch 3)

The OAuth gateway on port 43881 supports independently requested `cluster.read` and `cluster.control`. Only `cluster.control` can enumerate and request all 14 legacy MCP tools; its OAuth consent page displays a distinct high-privilege warning. It does **not** automatically enable local access: in ClusterOpt2 select the Explorer workspace, grant precisely the required ToolBox CRUD permissions, and independently enable PowerShell. The browser must approve **each exact PowerShell command**. Revoking ToolBox access prevents future commands even with an unexpired OAuth token. `cluster.read` continues to expose only the five read-only tools. Do not use elevated or administrator local Agent processes. Live Windows E2E security testing remains required.

## PR20.1 Patch(+4): wired host tool routes
Legacy Explorer calls `cluster.list_roots`, `cluster.list_directory`, `cluster.read_path`, `cluster.create_file`, `cluster.write_path` and `cluster.delete_path` now route through the registered host `PluginExplorerObject` using HubUnit requests. Create/update/delete require their own granted ToolBox rights. Large file reads use bounded file slices with offset/length. `cluster.find_root_windows_path` requires a separate, trusted browser prompt and is marked unverified (the browser directory handle cannot prove Windows path identity). `cluster.open_powershell` requires an enabled PS switch and opens the existing PowerShell UI, not a command executor. `cluster.powershell_request` still demands per-command approval from `PluginShellApprovalObject` before the local Node Agent executes it.
