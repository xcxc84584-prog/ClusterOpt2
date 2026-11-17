# PR20 AI Agent MCP remote control — remaining gates

| No. | Status | Acceptance |
| --- | --- | --- |
| 87 | Pending CI | Node PR20 MCP catalog, OAuth scope, Agent dispatch and Explorer permission unit tests |
| 88 | Pending CI | Playwright UI download, 0 textarea, ToolBox control, tab behavior, localization |
| 89 | Pending real Windows | Agent port 43879 pairing, browser bridge register/revoke and multi-root path behavior |
| 90 | Pending real Windows | MCP 43880 + OAuth 43881 over stable HTTPS issuer, authorization code + PKCE, consent, expiry, wrong origin |
| 91 | Pending real Windows | cluster.control CRUD create/read/update/delete, browser native file handles, 1 MiB write cap, chunk boundary |
| 92 | Pending real Windows | PowerShell tab open/deny, command approved/denied, output/timeout and no admin process |
| 93 | Pending security | OAuth cluster.read cannot enumerate or invoke privileged tool; explicit cluster.control cannot bypass browser ToolBox; revocation race |
| 94 | Pending load / compatibility | Concurrent EventChains, large output, command cancellation, PS timed approval, browser restart, missing local Agent |

Do not merge PR20 until these gates pass or documented exceptions are reviewed. Preserve read-only default.
