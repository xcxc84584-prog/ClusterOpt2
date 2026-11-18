# Patch(+1) — 2026-11-18
## Source comparison
Legacy xcxc84584-prog/Cluster uses agent_terminal/start-background.cmd, run-hidden.vbs, remote-mcp.cjs, oauth-mcp-gateway.cjs and tools/mcp/Cluster-ChatGPT-OAuth-Connect.ps1. New project adopted same Node protocols, ports remapped: Agent 43881, MCP 43880, OAuth 43879.

## Changes
- Replace fragile per-file CMD download loop with one pinned Setup-MCP.ps1; installer downloads original Node gateways, no persistent CMD/PowerShell.
- Background-Gateway.ps1 process record/health/state and explicit Stop actions; optional Cloudflare quick tunnel to OAuth-only 43879.
- MCP remote bridge loads pairing-token.dpapi via existing secure-store.cjs instead of obsolete plaintext pairing-token.
- Remove embedded iframe guide; switch navigation to setup. Saved token shows Start Agent action, no secret is sent to sandbox.
- Retain legacy opt-in Remember functionality with at-rest host encrypted vault, including migration from existing localStorage.
- Migrate regression tests; add Windows native lifecycle and PID tamper test.
## Remaining
- Real user Windows installation, actual public OAuth tunnel and ChatGPT connection should be manually verified; CI tests exercise localhost only.
- Existing transient cloudflared hostname changes on restart; consider optional verified domain for stable deployment.
