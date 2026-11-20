# PR24 Patch(+3) — Host RPC controller foundation

Date: 2026-11-20. Draft branch; not merged.

## Code
- PluginBidirectionalRPCController as a separate host-only helper.
- Request map pinned to session and owning MessagePort.
- Request/Response validation via PluginBidirectionalEnvelopePolicy.
- FIFO bounded queue, concurrency and overload response 429.
- Host -> plugin timeout, best-effort cancellation,
  transport failure settlement, session revocation and close cleanup.
- Targeted Node tests for out-of-order response, replayed response,
  foreign port, invalid payload, queue, deadline and cancellation.

## Invariants / limitations
- No change to the old PluginSandboxBridge runtime path.
- No live Plugin -> Host reverse RPC yet; this is the host-to-plugin
  transport controller and its isolated tests.
- Full requestId mapping with external session authority still needs
  integration, HubUnit ACL checks, OMU event chains and VTE.
- Cancellation locally settles the Promise, but cannot forcibly
  abort already executing arbitrary plugin code without Worker death.
- Deadline is scheduled upon enqueue, so queue waiting time counts.
  Regression tests cover expiration without dispatch.
- Request queue policy is FIFO; Serial/Per-Slice and cross-plugin
  fairness are future stages. Memory and CPU limits are not guaranteed.

## Gate
Node and browser CI must be checked for this exact HEAD before
claiming any test PASS. Do not merge PR24 to main.

## Patch(+3) follow-up
- Corrected capacity accounting: count each pending task exactly once.
- Added tests for queue-time expiry and full-capacity saturation.
- These changes remain transport-neutral until runtime integration.
