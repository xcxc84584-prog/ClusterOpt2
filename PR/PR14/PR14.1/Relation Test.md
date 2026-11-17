# PR14.1 — Contract and browser test matrix

This is an **inspection-based** compatibility test specification.
No Windows loopback, OAuth end-to-end, browser UI simulation or CI has been executed by PR14.1.

| ID | Scenario | Expected | Result |
| --- | --- | --- | --- |
| T01 | No AI plugin installed | No AI button or leftover overlay | NOT RUN |
| T02 | Install valid plugin Manifest | Explicit approval, Hub/URU registration | NOT RUN |
| T03 | Reload browser | Package retained if configured; fresh registration, no stale grant | NOT RUN |
| T04 | AI button beside PowerShell | Independent tab/output UI, Explorer unaffected | NOT RUN |
| T05 | Change Language | All visible agent labels zh-Hant/en | NOT RUN |
| T06 | Change UI_COLOR | Plugin UI follows shared palette | NOT RUN |
| T07 | Invalid/expired pair token | 401/403 EHU, no privileged action | NOT RUN |
| T08 | Provider key not configured | Safe error; key not logged or in browser bundle | NOT RUN |
| T09 | Prompt sent/stop task | Task state and cancellation accurately reflected | NOT RUN |
| T10 | Explorer read/create/write/delete | Granular grants; path traversal blocked | NOT RUN |
| T11 | Shell command requested | Host approval for exact command; deny/timeout fail closed | NOT RUN |
| T12 | MCP read-only OAuth scope | No shell/file-write tool through read-only scope | NOT RUN |
| T13 | OAuth PKCE/redirect mismatch | Fail closed and audit | NOT RUN |
| T14 | Local Agent offline/reconnect | Bounded retry, no duplicate task execution | NOT RUN |
| T15 | Plugin upgrade/uninstall | Stop task, revoke bridges/ports, preserve migration policy | NOT RUN |
| T16 | Malicious plugin requests host DOM / internal object | Denied by sandbox and Hub ACL | NOT RUN |
| T17 | 2 independent reads | Bounded parallel PASS and unique event IDs | NOT RUN |
| T18 | 2 conflicting writes | Serialized or 409; unchanged file on failed operation | NOT RUN |
| T19 | EHU/Log/Dependency evidence | Every EventChain observed by VTE + OMU | NOT RUN |
| T20 | MCP remote connector end-to-end | Real ChatGPT OAuth tool discovery and calls | NOT RUN |

## Pre-merge evidence gate
- Run existing npm checks once (avoid duplicate in-flight CI jobs).
- Run matching VTE object/event/permission tests with logs.
- Run Chromium UI and sandbox adversarial tests.
- Windows actual machine: Local Agent, ConPTY, OAuth tunnel and consent.
- Verify rollback ref before any major PR14 merge. No merge in PR14.1.
