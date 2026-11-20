# PR24 Patch(+1) — Protocol baseline

Date: 2026-11-20. Draft, no release.

## Added
- PluginBidirectionalEnvelopePolicy: versioned symmetric envelope,
  bounded target/action/IDs/deadline, valid response/error semantics,
  no embedded caller/session identity and pure validated projection.
- PR24 envelope contract tests including hostile input and invalid
  session identity cases.
- Plan/ArcD and initial handoff.

## Not yet implemented
This patch does not attach to PluginSandboxBridge, does not establish
a trusted PluginSession, and does not enable Plugin → Host requests.
Do not label PR24.01–10 as complete until inventory/conformance is
finished and CI evidence recorded.

## Risk and compatibility
Legacy PluginRPCContractPolicy remains untouched. Host authorization,
real session binding, cancellation settlement and user-facing SDK are
still pending. Existing tests require CI verification on this branch.
