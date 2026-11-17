# PR9 Patch(+3) — Old ClusterOpt PowerShell UI parity

## Defect
Patch2 incorrectly placed PowerShell under File Tool, with an invented
dock-style UI inconsistent with old ClusterOpt. User requests the old
version's original PowerShell UI and functionality.

## Changes
- Copy legacy ClusterOpt v0.0.69 PowerShell UI, client, manager,
  permission-policy and CMD bootstrap implementation into isolated
  Implementation/main/legacy-powershell files.
- Restore the exact `explorerPowerShell` glyph button beside
  `explorerToggle` in header-utility; delete the File Tool button.
- Port the complete v0.0.69 PowerShell CSS declaration range into a
  dedicated stylesheet, to preserve wizard, configuration, native
  terminal, classic appearance and palette behavior.
- Bridge current Language Property to legacy read/subscribe API and
  CSS palette updates to the legacy UI's subscribe API.
- Keep legacy PowerShell tabs in sync after new editor DOM redraw,
  preserving each legacy session and native ConPTY connection.
- Remove Patch2's non-parity nativePowerShellPane, its session manager
  and connection property, and their superseded unit tests.
- Original local agent remains separate and must be installed by
  the user; no webpage can directly spawn PowerShell.
- Security: pairing token and system command execution remain in
  original local-agent channel; do not expose remote loopback ports.

## Regression and criteria
- Explorer and PowerShell buttons are siblings in top toolbar.
- No PowerShell item appears in File Tool.
- Click PowerShell icon repeatedly creates independently tracked tabs.
- Old 3-step setup, toolbar, settings, close, clear, pairing, full
  terminal and palette components are present.
- Opening a file tab hides PSM without closing its sessions.
- No regression to editor data, GoToLine and existing explorer.
- CI and browser tests must pass before merge; Windows ConPTY parity
  requires user machine acceptance.

## Rollback
Previous merged main PR9 Patch2 SHA:
90b7c690ca48a5d64f09f90602f4c0c473e50a7f.
