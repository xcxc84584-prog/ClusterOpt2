# PR21.2 Patch(+1)

- Removed inert `caiTokenPreview` from sandbox. Reserved responsive `caiTrustedPairSlot` for the trusted form.
- Trusted host form uses 1:3 Port and Token fields and a direct submit action; secret never goes through iframe or core request payload; clears after staging. Port validates 1024–65535, token 64 hex chars.
- `PluginLocalAgentObject` accepts a one-shot host credential and consumes/discards it on pairing.
- PowerShell CPO: changed PID/creation identity remains a hard stop for O but no longer aborts entire installation; user can choose P or C.
- MCP CMD: isolated per-asset download, explicit failures.
- Updated previous mock pairing E2E steps, contract tests, and added PR21 pairing coverage. Windows and real HTTPS tests remain separate.
