# PR24 architecture references and applicability

Reviewed 2026-11-20.

## VS Code
- https://code.visualstudio.com/api/extension-capabilities/overview
- https://code.visualstudio.com/api/extension-guides/webview
- https://code.visualstudio.com/api/extension-guides/web-extensions

VS Code separates extension code from native editor DOM and uses
controlled contribution points. ClusterOpt2 should analogously expose
UICO and typed SDK APIs rather than handing untrusted plugins native
DOM references. Its webview message-passing design supports isolating
plugin subpages from host privileges.

## Web platform
- https://developer.mozilla.org/en-US/docs/Web/API/MessagePort
- https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API

MessagePort provides explicit channel transfer. An attacker-supplied
sessionId field must not substitute for the channel's trusted binding.
Structured clone is not a permission system; ClusterOpt2 retains the
existing restricted JSON-only message validation as a separate layer.

## Decision
Use an isolated transport plus host-owned session record, dynamic
HubUnit ACL at dispatch, separate pure protocol policy and external
SDK. Do not port VS Code code or assume the same operating-system
process isolation in a browser-only GitHub Pages deployment.
