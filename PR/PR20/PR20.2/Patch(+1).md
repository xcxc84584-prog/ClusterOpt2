# PR20.2 Patch(+1)

- Rebuilt `Implementation/plugins/ai-agent-mcp/local-agent/MCP-Quick-Setup.cmd`: pinned all gateway sources to merged commit; single PowerShell download invocation; individual file diagnostic and fail-fast; corrected OAuth CMD label-flow.
- Fixed OAuth public service hostname prefix to `clusteropt2` with an explicit full HTTPS origin requirement.
- Added named Cloudflare Tunnel example to `MCP-SETUP.md`, explaining DNS ownership and keeping public network configuration manual.
- Added contract assertions for pinned revision and failure diagnostics.
- CI validation: review GitHub PR #68 checks after latest doc commit. No local Windows photo-reproduction claimed.
