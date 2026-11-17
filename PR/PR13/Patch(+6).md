# PR13 Patch(+6) — sandboxed execution & live Hub authorization

## Scope
- PR13.3: `PluginSandboxBridge` creates an opaque-origin sandboxed
  iframe (sandbox=allow-scripts, no allow-same-origin), with strict
  deny-network CSP. Bootstrap communicates exclusively by transferred
  MessagePort. Plugin ES Module text imports from a data: URL *inside*
  the isolated frame; no user script is imported into the host page.
- PR13.4: `HubUnit.invokeExternalPlugin` checks live URU Provider
  identity, Object action ACL, disabled state, and every runtime grant
  before EACH dispatch. `HubUnit.request` forwards caller identity to
  a receiver context, preserving the true source.
- PR13.2: `PluginHostInstallUnit` performs bounded package
  re-validation, explicit permission review, source extraction,
  sandbox bootstrap, Hub register Object + URU register Provider,
  runtime grant, atomic rollback and audit. It retains only disposable
  sandbox handles, NOT a second Object/Provider registry.
- Resources local folder action offers an explicit consent prompt with
  Provider ID and requested capabilities before running any code.
- PR13.5: bounded bootstrap/invocation timeouts, MessagePort closure,
  iframe removal, pending request rejection and OMU EHU/Log.
- PR13.6: unload UI uses the host installer for sandbox-backed
  Providers so unregister also terminates the isolated runtime.
- PR13.7: VTE tests for consent, permission revoke between calls,
  UserAPI routing, live Provider ACL, missing dependencies, uninstall.
  Playwright tests for opaque-origin DOM denial, real RPC, timeout EHU.
- Repaired previous Patch5 browser assertions: API detail has four
  sections (including protocol), and plugin template is no longer
  counted as a marketplace download Provider card.

## Supported behavior
- Self-contained ES modules exporting functions named after a
  declared Provider Action; handler accepts payload and returns value.
- Folder storage/export/import continues to preserve HTML/CSS/JS and
  binary assets without executing them in the host.
- Any requested non-Core capability needs an explicit affirmative
  user choice; nothing derives authority from Manifest alone.
- Each call goes through HubUnit and active runtime permissions.

## Known limitations / unclosed security gates
- Multi-file relative JS module imports and HTML UI runtime are NOT
  enabled. Those assets are persisted as inert package resources.
- Same-process iframe isolation does not guarantee hard CPU timeout for
  synchronous infinite loops. Asynchronous timeouts are bounded.
- Full cross-browser CSP, navigation, exfiltration and browser security
  regression must pass before describing PR13.3–13.5 as complete.
- User-authored plugins cannot auto-execute after reload yet: stored
  bytes alone are never an authorization grant.
- Updating/reloading external packages, dependency resolution and
  advanced capability relay remain incomplete.

## Recovery / release
Draft PR #58 remains open and unmerged; preserve
backup/pr13-prestart-20261117. No version bump before major PR13
release acceptance and CI.
