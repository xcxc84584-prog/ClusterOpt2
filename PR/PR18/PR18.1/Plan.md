# PR18.1 — AI Agent Windows Quick Setup Parser Repair

## Reported failure
Downloaded standalone CMD starts setup helper but PowerShell throws `UnexpectedToken` at Setup-Quick.ps1:144/170. Inspected main confirms line 141 was truncated in the `-notmatch '^[Yy]$'` expression and a duplicate trailing try/finally was appended.

## Work
- Restore the approval branch, one and only one native launch block, balanced try/finally.
- Update the standalone CMD to fetch the repaired immutable Git commit.
- Add explicit PS5.1 and PS7 AST parsing checks in Windows CI, plus Node regression tests.
- Remove Chrome-unsupported `navigate-to` from plugin sandbox *meta* CSP; preserve all supported isolation directives and opaque sandbox.

## Risk and verification
Do not auto-execute downloaded CMD in browsers. Never embed keys, escalate privilege or kill an occupied port without already-required P/C/O+OVERRIDE. Validate parser on Windows for both PS versions. Real port takeover and local Agent pairing still need on-device testing.
