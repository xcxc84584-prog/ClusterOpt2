# PR20.1 Patch(+5) — Unified C/P/O ports

## User requirement
- Local Agent: **43881**
- MCP Gateway: **43880**
- OAuth Gateway: **43879**
- Every service listener startup uses existing C/P/O semantics; O requires verified PID identity and explicit OVERRIDE acknowledgement.

## Implementation
- New local-agent/Port-CPO.ps1: single reusable port selection and safe override policy; persisted service-ports.json under user LOCALAPPDATA; no secrets or absolute machine paths in source.
- Start-LocalAgent.ps1, Start-MCP.ps1, Start-OAuth.ps1 share the policy and set CLUSTER_*_PORT variables explicitly.
- Setup-Quick.ps1 downloads the pinned shared helper and applies it to Local Agent.
- Both standalone CMD bootstraps download pinned sources; MCP CMD also downloads Port-CPO.ps1, ensures MCP selection finishes before optional OAuth startup.
- Local Agent browser pairing defaults to 43881 and allows custom user-entered port.
- MCP stdio reads the saved Local Agent port; Gateway upstream port variables are propagated from selected ports.
- Updated plugin package file allowlist, UI text and instructions.

## Event chain
CMD → validated downloaded launch script → Select-ServicePort (C/P/O) → selected configuration → loopback listener → registered Agent/MCP API bridge → EHU/Log as previously defined.

## Gates
- Automated Node port map and Windows PowerShell 5.1/7 parser tests added.
- Real Windows service occupation, OAuth reverse proxy update and end-to-end PS/CRUD grants require separate acceptance.
- Preserve rollback. No editor/HubUnit business logic changes; only plugin launchers, plugin API defaults and distribution list.
