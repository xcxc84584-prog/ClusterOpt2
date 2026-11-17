# PR14.7 Plan

## Goal
Per-command PowerShell approval on an authenticated local tool bridge

## Implementation
PluginShellApprovalObject; PluginLocalAgentObject tool dispatch; ToolBox PS toggle

## Security and load
PS OFF by default, named root required, exact command shown, 2,000 char maximum, one pending approval, deny unknown tools. Legacy agent still requires terminal session and local Windows runtime.

## Acceptance gate
Node/VTE PS approval and Chromium mocked WebSocket acceptance; actual signed-in Windows command execution must be manually verified.
