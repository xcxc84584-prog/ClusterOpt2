# PR24 Patch(+2) — Trusted port-bound Session foundation

Date: 2026-11-20. Draft branch only.

## Implementation
- PluginSession Object: handshake/ready/revoked state, frozen source
  identity, one MessagePort, request ID replay protection.
- PluginSessionUnit: host-owned port-to-session association,
  provider-wide revocation and new-session identity on replacement.
- Unit tests for wrong port, forged caller, replay, unready request,
  stale session and cross-port impersonation.

## Architectural guardrails
- A browser reload does not persist session identity.
- A valid message envelope is insufficient to authorize execution.
- MessagePort ownership is checked before consuming the envelope.
- Worker-provided caller/session identifiers are explicitly rejected.
- Session handshake is only a channel-liveness step, not user consent.
- The maximum 1024 replay IDs is deliberately fail-closed: the
  session is revoked rather than dropping old IDs and allowing replay.
- The global registry has no new shared Property; session bookkeeping
  is internal to the host Object layer.

## Explicitly outstanding
This Session foundation is NOT wired into PluginSandboxBridge or
HubUnit. It does not yet verify live Provider registration or
permission grants. No plugin -> host execution was enabled.
Integration must bind a port only after trusted installation and
use current URU/HubUnit ACL at every dispatch.

## Verification
Node tests are part of the existing `npm test` glob.
CI results must be reviewed for the exact patch HEAD.
