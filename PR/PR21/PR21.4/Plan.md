# PR21.4 Plan — Cluster Legacy MCP 背景化與配對導引
- Baseline: main 7008bd2484a98a2c1dd572ebd7ce1461a2ffbdba, PR #72 Draft.
- User defects: MCP Quick Setup prints Verified then exits with "Failed asset"; Agent repeats a huge standalone connection tutorial; retained pairing cannot immediately enter Agent.
- Implementation (reuse, not rewrite): preserve Cluster agent_terminal/remote-mcp.cjs, oauth-mcp-gateway.cjs, OAuth PKCE/authorization and Cloudflare Quick Tunnel interface. Replace only CMD download orchestration, process management, and DPAPI adaptation.
- Native bootstrap: immutable Git SHA, CMD downloads one Setup-MCP.ps1; reviewed assets downloaded by PowerShell; Background-Gateway.ps1 supervises MCP/OAuth/optional cloudflared as signed-in Windows user with hidden processes.
- Web UI: delete separate guide block, Connection Settings navigates existing setup; saved host-owned credential leads to "開始使用AI AGENT功能". Host-only opt-in legacy Remember pairing migrated from plaintext localStorage into AES-GCM non-exportable IndexedDB key + ciphertext.
- Security: no embedded keys; no plugin access to token; authenticated MCP remains 127.0.0.1 and OAuth reverse-proxied; C/P/O retained, PID/CreationDate/ExecutablePath/cmd signature and port ownership validated before stop; explicit OAuth permission and PowerShell confirmation remain in ToolBox.
- Load: two local Node services + optional cloudflared, no busy-loop after startup, bounded startup health probes. CI tests avoid real public tunnel; production Cloudflare requires actual network.
- Test gate: npm check, browser regression, Windows PS 5.1/7 syntax, Windows real MCP/OAuth start/stop with fake HTTPS metadata, credential migration, Quick Setup downloader and rollback SHA validation. No product version update until release.
