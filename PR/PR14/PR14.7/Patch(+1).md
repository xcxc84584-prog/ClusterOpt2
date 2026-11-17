# PR14.7 Patch(+1)

Delivered on Draft PR #61 branch pr14/ai-agent-mcp-audit.
PluginShellApprovalObject; PluginLocalAgentObject tool dispatch; ToolBox PS toggle

Security: PS OFF by default, named root required, exact command shown, 2,000 char maximum, one pending approval, deny unknown tools. Legacy agent still requires terminal session and local Windows runtime.

Automated tests were added where supported; the following gate
must not be marked PASS without direct evidence: Node/VTE PS approval and Chromium mocked WebSocket acceptance; actual signed-in Windows command execution must be manually verified.

No core application business logic changed and no release version bump.
