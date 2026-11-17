# PR14.4 Patch(+2) — Host pairing dialog and browser tests

## Changes
- Host-owned bilingual modal input replaces fragile asynchronous
  browser prompt. Pairing token stays in trusted DOM and is erased
  as soon as the dialog is submitted/cancelled.
- Terminate a pending token dialog on disable/uninstall.
- Add Chromium PR14.4 test with fake loopback socket, read-only
  auth/ready/ping/pong assertions, token isolation and tool_call deny.
- Correct VTE provider registration 201 and OMU dependency projections.
- Route attempted actions without a live network grant through HubUnit
  so the Object emits EHU 403, rather than dropping silently.

## Compatibility
The old server expects the *exact origin* configured as
CLUSTER_TERMINAL_ORIGIN and its pairing token stored locally by
the Windows agent. No bridge_register is sent, and tool calls are
rejected, including legitimate future requests until PR14.6–14.8.

## Outstanding
- Real installed Windows Agent pairing not verified in this environment.
- CI and Chromium validation must be inspected for final SHA.
- Browser modal and TLS/mixed-content origin behavior depend on
  actual deployment; fake socket test alone does not prove the service.
