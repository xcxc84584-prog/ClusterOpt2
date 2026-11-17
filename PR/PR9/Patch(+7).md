# PR9 Patch(+7) — Explicit P/C/O port override

## Request
When port 43881 (or an alternative user-selected port) is occupied,
offer [P]ick another port, [C]ancel or [O]verride. The user must
explicitly request O to terminate existing listeners, verify that
the port has been released, and start the new Local Agent.

## OCDA & security
The installer is a user-initiated native OS boundary, not a browser
Object. It does not circumvent HubUnit or grant browser-side access.

- Get-PortListeners queries active TCP listening processes only.
- Release-OccupiedPort resolves each listening PID via Win32_Process.
- No termination occurs merely from selecting O; the installer
  displays PID, name and executable path and demands the exact
  confirmation word OVERRIDE.
- Reject system PIDs, the installer, its parent process chain,
  protected Windows process names, and unknown process identities.
- Before Stop-Process -Force, revalidate each PID's CreationDate and
  Name, and confirm it still listens on the selected port.
- An interrupted/changed owner, access denial or failed port release
  aborts instead of starting a second agent. Never kill by name,
  wildcard or unverified PID.
- Unknown commands do not stop any process; C cancels, P selects
  an alternate user-supplied port.
- This deliberately can terminate an unrelated *ordinary* process
  when a user explicitly confirms OVERRIDE; loss of that process's
  unsaved work is possible. Provide warnings before termination.

## Performance
- Get-NetTCPConnection and CIM queries touch only the selected
  local listener PIDs; each owner is inspected twice for identity.
- After termination, port release is polled at 250-ms intervals for
  a bounded 20 attempts (5 s), no background monitor or daemon.
- Local Agent launch remains sequential after dependencies and
  port availability check. No additional web request is introduced.

## Tests
Windows PowerShell 5.1 and 7 AST parser workflow checks valid
PowerShell, 7 function definitions, user choice O, exact OVERRIDE
confirmation, protected process guard and PID revalidation.
Node OCDA regression verifies the opt-in handler and fail-safe text.

## Version and compatibility
LinkCore.SystemVersion is the sole version publisher:
0.0.9-pr9.patch7. Root and local-agent manifests mirror that
version for npm and installer verification.
Previous PR9 Patch6 remains restorable through Git/GitHub.
Manual Windows process-stop behavior requires deliberate acceptance;
do not test O against important or unrelated programs.
