# PR14.2 Plan — Contract-first plugin

## Actual implementation
`Implementation/plugins/ai-agent-mcp/` contains a self-contained plugin:
- plugin.json: Provider Manifest v1, two uniquely named services.
- worker.js: named exported actions getStatus and describe.
- README.md: installation, current limits and subPR roadmap.

No host runtime source, permission registry, UI or version changes.
Permissions and dependencies are empty, as PR13 does not yet offer
AI-specific privileged capability gates.

## Target mappings
| Proposed Object | Status | Owner |
| --- | --- | --- |
| AIAgentMCP | Implemented through existing HostInstallUnit / URU | Worker |
| AIAgentPanel | Deferred PR14.3 | Plugin UI, not host DOM |
| AIAgentSession/LocalBridge | Deferred PR14.4 | Authenticated host adapter |
| AgentTaskCoordinator | Deferred PR14.5 | Model/task adapter |
| AgentExplorerAdapter | Deferred PR14.6 | Browser host capability |
| AgentShellAdapter | Deferred PR14.7 | Local host capability |
| AgentMCPAdapter/AgentOAuthAdapter | Deferred PR14.8 | External local service |

No new global EDPMU Property; API contracts are declared within
the Provider Manifest and validated by existing property policies.

## Capacity/security
Manifest budget 64 KiB; Provider 32 KiB; Worker <=2 MiB asset.
Two bounded synchronous read-only actions, allowed parallel execution.
No secrets or absolute machine path; no file I/O, shell or network call.
No fake model connectivity or credentials. Relation default 00,
normal Hub request only for authorized callers.

## Test plan
Node contract validation; worker export/declared action parity;
VTE install permission denial, Hub Req/Rep, invalid schema, absent
action, EHU and uninstall. Browser installation and real opaque iframe
execution must be independently verified before acceptance.

## Known architecture blockers
- Host sandbox cannot yet execute multi-file JS import graphs.
- uiEntry is staged but not executable UI integration.
- Privileged permissions are currently restricted to existing
  PluginPermissionPolicy allowlist.
- No host-owned Local Agent/shell/file bridge can be requested yet.

Address these explicitly in PR14.3–14.8; any essential host extension
is a separately reviewed plugin architecture fix, not an AI Agent
core-code shortcut.
