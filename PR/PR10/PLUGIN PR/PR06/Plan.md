# PLUGIN PR06 Plan

## Patch1 PR06.01/02/05
Review Comlink postMessage RPC and Eclipse Theia plugin host architecture. Keep one URU Provider authority and HubUnit REQ/REP. Introduce independent bounded JSON-data validation and narrow manifest permission allowlist; grants stored only in runtime PluginPermissionUnit, not in persisted Manifest. Legacy Provider registration unchanged; no default grants. Owner-only grant/revoke, privileged host approval and core-deny.

## Threat model
Untrusted scripts can try DOM access, direct fetch, File Handle transfer, permission escalation, prototype pollution, postMessage replay, oversized payload, or denial of service. A same-origin Worker does NOT prevent network access, so unreviewed source execution is blocked until PR06.04 isolation and PR06.07 integrity. Never accept code/data URLs as plugin sources.

## Performance
Permission checks O(1); message validation O(bytes) bounded to 64 KiB, depth 8 and 128 children; grants bound to URU provider lifecycle. No modified File I/O or editor UI.

## Upstream reviewed
- https://github.com/GoogleChromeLabs/comlink/blob/main/README.md
- https://github.com/eclipse-theia/theia/blob/master/README.md
