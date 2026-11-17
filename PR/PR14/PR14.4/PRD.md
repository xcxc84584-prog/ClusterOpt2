# PR14.4 PRD — Local Agent pairing and secure communication

## Requirements
- Preserve legacy Cluster /agent WebSocket authentication handshake:
  connect to loopback:43879, send auth token and require ready.
- Explicit installer consent and network.request capability grant required.
- Token entry only in host UI; no token in plugin iframe, Worker, Hub
  Request payload, OMU log, localStorage, sessionStorage or packages.
- Expose host-routed pair/ping/disconnect/status operations only.
- Do not send bridge_register, task, provider_set, tool_result,
  shell or filesystem requests before their own PR gates.
- Handle malformed token, unexpected messages, timeout, shutdown,
  disconnect, uninstall, disable and permission revocation.
- Preserve dynamic URU registration, independent VTE cases, rollback.

## Acceptance
VTE PASS/FAIL cases, browser UI pairing and security checks, latest
CI and actual Windows-agent handshake before full end-to-end PASS.
