# PR14.10 Patch(+4) — MCP-only bridge registration fix

The final Chromium failure (123/124 passed) traced to a real protocol bug:
PluginLocalAgentObject accepted bridge_registered only when the
PowerShell bridge was active. Activating MCP Read-only alone caused the
same valid acknowledgement to be classified unexpected, closing the
authenticated local socket and clearing the toggle.

Fix: accept the acknowledgement when either shellApprovalId OR mcpReadId
is active. Unknown unsolicited tool messages and unregistered acknowledgements
remain fail-closed. Restore strict Playwright checkbox assertion.
No new core business logic; no release version change.

The final CI run must PASS; real Windows Local Agent/real OAuth and model
key-at-rest protection are external release blockers.
