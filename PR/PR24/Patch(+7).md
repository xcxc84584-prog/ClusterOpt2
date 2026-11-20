# PR24 Patch(+7) — Session lifecycle and cancellation

Status: Draft, changes are isolated to feature/pr24-bidirectional-plugin-sdk.
Base main is unchanged. Prior Patch(+6) had 9/9 CI success.

## Implementation
- Session revocation optionally preserves the host-owned MessagePort.
  A revoked Session loses its original port association and its replay
  history, permitting a new host-generated Session ID and challenge.
- Transport.suspend() rejects further inbound packets, emits
  cluster-session-suspended, aborts in-flight Hub signals, and tears
  down listeners while preserving the Worker port.
- Transport.resume() establishes a new Session over the same port.
- Bridge exposes host-only suspendHostRequests/resumeHostRequests.
- PluginHostInstallUnit rotates Sessions on disable/enable.
  Upgrade transaction suspends the old Session and restores it with
  a fresh challenge after rollback; successful upgrade terminates old.
- Worker Client pauses request submission on suspension, rejects
  outstanding Promises, and allows fresh handshakes on the same port.
- Worker supports AbortSignal and forwards cancel messages.
- Transport maps cancellation by Request ID inside the same port,
  aborts HubUnit.request with AbortSignal and bounds in-flight work.
- Host deadlines include the whole request, not only queue time.
- Overload sends a typed 429 response rather than silent timeout.
- Gateway discards responses if the Session, Provider, or grant was
  revoked after asynchronous HubUnit execution.

## Tests
- Node MessageChannel: suspend/rotate, abort propagation, overload.
- Node Gateway: stale responses after Session or grant revocation.
- Browser E2E: disable/re-enable, new Session ID, request success.
- Prior tests for legacy invoke and original sandbox remain intact.

## Security limitations
- Aborting a request does NOT undo a committed side effect of a
  target Object that ignores AbortSignal. A target should cooperate.
- No complete per-action capability ACL or cross-plugin SDK guarantee.
- Cancel messages do not promise an application-level cancel ACK.
- The Worker shim is not yet a published versioned SDK.
- CI result must be checked against this exact Patch(+7) head.
- PR24.01–100 remain open pending end-to-end independent plugin
  conformance, VTE and rollback snapshot.
