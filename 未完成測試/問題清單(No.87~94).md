# PR20 AI Agent MCP remote control — remaining gates

| No. | Status | Acceptance |
| --- | --- | --- |
| 87 | Pending CI | Node PR20 MCP catalog, OAuth scope, Agent dispatch and Explorer permission unit tests |
| 88 | Pending CI | Playwright UI download, 0 textarea, ToolBox control, tab behavior, localization |
| 89 | Pending real Windows | Agent port 43881 pairing, browser bridge register/revoke and multi-root path behavior |
| 90 | Pending real Windows | MCP 43880 + OAuth 43879 over stable HTTPS issuer, authorization code + PKCE, consent, expiry, wrong origin |
| 91 | Pending real Windows | cluster.control CRUD create/read/update/delete, browser native file handles, 1 MiB write cap, chunk boundary |
| 92 | Pending real Windows | PowerShell tab open/deny, command approved/denied, output/timeout and no admin process |
| 93 | Pending security | OAuth cluster.read cannot enumerate or invoke privileged tool; explicit cluster.control cannot bypass browser ToolBox; revocation race |
| 94 | Pending load / compatibility | Concurrent EventChains, large output, command cancellation, PS timed approval, browser restart, missing local Agent |

Do not merge PR20 until these gates pass or documented exceptions are reviewed. Preserve read-only default.

## No.95–98 (PR20.1 Patch 5)

| No. | Status | Gate |
| --- | --- | --- |
| 95 | CI running | Windows PS5/7 Port-CPO parse + fake busy C/P/O tests |
| 96 | CI running | Node default port map, CMD assets, browser pairing and localized instructions |
| 97 | Pending real Windows | O process identity recheck; ensure unrelated processes never stopped without typed OVERRIDE |
| 98 | Pending real HTTPS | Changed OAuth port uses matching reverse-proxy target; changed Local Agent port survives browser pairing and gateway route |
