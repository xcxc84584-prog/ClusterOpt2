# PR21.3 Patch(+2) — Built-in Agent / DPAPI / user-scoped background
Date: 2026-11-18
Base main: `5ebe730364c6b3a1dbf5892accc3d230a378dedf`
Working branch: `feature/pr21-3-ai-agent-ui-runtime`
Release version: `0.0.15b` (unchanged)

## Changes
1. Host-owned default launcher with saved opt-out and explicit first-activation capability review.
2. Windows DPAPI CurrentUser encrypted pairing token and provider key, with verified plaintext migration and explicit token rotation.
3. Hidden Local Agent process launched after guided setup, with Status/Stop/Token administration and identity checks.
4. Quick-Setup/ZIP asset allowlists and pinned installer revision updated.
5. Dedicated Windows DPAPI tests, Playwright UI/reload tests and updated PR17/18/20 regression expectations.

## Threat model
The launcher alone has no plugin capabilities. There is no bearer token in HTML, localStorage, iframe postMessage or GitHub sources. User consent is still required to mount any executable provider. File and PowerShell grants remain separate. Background Stop rejects stale or mismatched process IDs and occupied unrelated ports; C/P/O requires deliberate user input.

## Evidence and gates
- Windows DPAPI Protect/Unprotect + legacy migration: PASS via AI Agent Quick Setup Parser workflow.
- Windows PowerShell 5.1 parser: PASS; PowerShell 7 parser: PASS in same workflow.
- Node `npm run check`: PASS after updating legacy startup assertions.
- Playwright responsive/opt-out and entire suite: PENDING final CI conclusion.
- Windows 5.1/7 real background launch, ConPTY, network/MCP/OAuth, return-after-reboot: NOT RUN.
- Main merge: BLOCKED until accepted browser and real-machine safety gates.

## Recovery
Keep main at base SHA. Revert the PR branch to the above base if failing any gate. No shared Property added, global Property registry unchanged.
