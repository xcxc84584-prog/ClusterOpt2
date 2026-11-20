# PR24 Patch(+5) — Real MessagePort adapter integration test

Status: DRAFT, partial integration, not merged into main.

## Added
- PluginHostRequestTransport manages host-owned MessagePort listeners.
- After registered Provider bootstrap, it creates a PluginSession
  and sends the one-time handshake challenge to the transferred port.
- Ready handshake is verified by PluginSessionUnit.
- Plugin -> Host RPC traffic reaches PluginHostRequestGateway, which
  enforces live URU identity and grants, then HubUnit.request.
- Bounded concurrent inbound processing and detached listener cleanup.
- Node worker_threads MessageChannel integration test exercises an
  actual structured-cloned message exchange, not only fake ports.
- Tested removal of the listener and session revocation.

## Gate and limitations
- Real transport adapter is separately wired to a MessageChannel in
  Node tests. It is NOT yet connected to the production iframe/Worker.
- Existing sandbox bootstrap and installer remain unchanged.
- Client-side plugin SDK and production reverse-call bootstrap missing.
- Each error is currently audited but not all rejection cases return
  an error response to the Worker; resolve before publishing SDK.
- Cancellation and job-abort propagation are still incomplete.
- Need real browser VTE E2E and permission revocation under race.
- No exhaustive third-party plugin compatibility validation yet.
