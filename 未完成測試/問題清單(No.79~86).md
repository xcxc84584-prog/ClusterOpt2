# PR14.6–14.10 validation and release blockers

| No. | Status | Gate / risk |
| --- | --- | --- |
| 79 | Automated | PR14.6 native picker, scoped read/write/delete and revoke in Chromium; automated picker is mocked, real Windows still required |
| 80 | Automated | PR14.7 authenticated tool_call with exact-command modal, denied request and output; use real Windows Agent for terminal execution acceptance |
| 81 | Pending real host | Run packaged local server, pair origin, execute and cancel a bounded PowerShell command; confirm stdout/stderr and no privilege escalation |
| 82 | Pending real host | MCP stdio, bearer gateway and OAuth PKCE against trusted HTTPS issuer, local approval, revocation, incorrect origin and expiry |
| 83 | Pending security review | Legacy API key is persisted on local Windows disk without verified encryption; do not approve production use until protected |
| 84 | Pending browser matrix | Chrome/Edge secure-context File System Access and local WebSocket permissions; HTTPS mixed-content/local-network behavior |
| 85 | Automated | Plugin disable, uninstall, rollback and package migration never preserve ToolBox/PS/MCP grants |
| 86 | Pending load/security | Large shell output, parallel requests, command timeouts, reconnect races and malicious messages under real Agent stress |

## Release invariant

All GitHub CI and real-host gates must PASS before PR14 is considered
a complete release. Do not publish system execution claims from mock
WebSocket or in-memory file handles. No automatic main merge, native
gateway startup, or arbitrary external OAuth tunnel.
