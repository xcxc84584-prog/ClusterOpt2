# PR24 Patch(+6) — Production Worker reverse RPC wiring

Date: 2026-11-20. PR #80 DRAFT. main remains unchanged.

## Implementation
- PluginWorkerSource: explicit Worker-side Cluster.request and ready
  promise over its isolated MessagePort, without host DOM access.
- PluginSandboxBridge: preserve legacy invoke path and attach a new
  PluginHostRequestTransport on the same transferred host port only
  after a trusted Provider is registered.
- PluginHostInstallUnit: enable reverse transport after registration,
  permissions and UI mount; activation failure rolls back.
- PluginHostRequestTransport ignores the legacy invoke/response kinds.
- PluginHostRequestGateway returns explicit 403 Response packets after
  a valid Session request with revoked privileges.
- Bridge termination revokes Session and closes MessagePort.
- Updated legacy sandbox Playwright expectation: isolated Worker has
  a scoped Cluster.request method but no native host DOM.
- Added pr24-reverse-rpc.spec.js: browser-only real Worker to UICO
  request, rejected action, correlated OMU events and uninstall cleanup.

## Security invariants
- Session source identity comes from the host-owned MessagePort, not
  plugin-provided callerId/sessionId.
- URU and runtime permission status are checked on every call.
- HubUnit remains sole Object dispatch authority.
- Worker cannot access native DOM, IndexedDB or cross-origin services
  under the existing opaque sandbox and CSP.
- The public Worker Cluster.request method does not grant permissions.

## Known limitations
- In-flight cancellation cannot forcibly stop a side-effecting Host
  operation; cancellation and revoke races need browser VTE coverage.
- Disabled Provider is denied through live URU checks but its existing
  MessagePort Session is not closed; enabling resumes with the same
  Session. Session rotation on disable/enable is not yet implemented.
- The Worker API is a runtime shim, not a separately published SDK.
- No comprehensive third-party Plugin SDK conformance achieved.
- All PR24.01–100 acceptance and rollback checks remain open.

## Verification
CI must be reviewed on the exact final commit and failures corrected.
