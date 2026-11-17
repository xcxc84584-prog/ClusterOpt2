# AI AGENT MCP(ChatGPT) — PR14.2

This folder is a complete **installable contract-only plugin**.

## Installation
Use ClusterOpt2 Resources > local plugin-folder picker to select this folder,
review the provider identity and approve installation. No capability grant
is requested. Registration is runtime-only through HubUnit/URU.

## Currently implemented
- `cluster.ai-agent.status` / `getStatus({})`
- `cluster.ai-agent.contract` / `describe({})`
- Worker isolation and strict Request/Response schemas

**Not implemented yet:** legacy AI UI, Local Agent pairing, models, task
pipeline, Explorer CRUD, shell execution, MCP and OAuth. The responses are
honest about this: status is `contract-only`, disconnected and unprivileged.
There is intentionally no `uiEntry` or privileged permission declaration.

No API keys, token storage, absolute paths, browser globals or direct OS
calls. Plugin source may not bypass the host-owned capability authority.

## Roadmap
PR14.3 UI / Language; PR14.4 authenticated transport; PR14.5 models;
PR14.6 Explorer; PR14.7 shell approval; PR14.8 MCP/OAuth;
PR14.9 lifecycle; PR14.10 security and browser acceptance.
