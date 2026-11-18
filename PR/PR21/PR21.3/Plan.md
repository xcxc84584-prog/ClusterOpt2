# PR21.3 Plan — AI Agent MCP plugin UX and runtime

Base: `5ebe730364c6b3a1dbf5892accc3d230a378dedf` (release 0.0.15b). Work branch: `feature/pr21-3-ai-agent-ui-runtime`.

## PRD and scope
UI-01 same-panel connection guide; AUTH-02 secure optional credential persistence; PLUGIN-03 bundled default install with opt-out; SERVICE-04 background user-scoped service; TOOL-05 outside click close; LAYOUT-06 full workbench width and rightmost scrolling.

## Implementation sequence
1. UI-01, TOOL-05 and LAYOUT-06: modify bundled plugin HTML/CSS and trusted-host iframe message handling. Preserve host-only pairing fields, 1:3 Port/Token, strict origin/source validation.
2. Inspect runtime plugin installation lifecycle, explicit grants and persistent opt-out before enabling built-in automatic installation.
3. Design credentials protected by Windows user scope; do not persist secrets in page storage or iframe.
4. Implement detached user-scoped service manager with identity-checked stop/restart and C/P/O.
5. Run Node, VTE, Playwright responsive tests, Windows PowerShell 5.1/7 and real local agent/OAuth tests.

## Threats and resources
No implicit PowerShell/file privileges; no key in source, URL, logs, events or bundle. Default installation must be idempotent. Layout ResizeObserver messages should be bounded/de-duplicated. C/P/O must not terminate unrelated processes.

## Gate
Release version remains 0.0.15b until explicitly selected. No merge without CI and the necessary Windows security acceptance. This PR is a draft in progress.
