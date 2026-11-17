# PR18.1 Patch(+1)

- Fixed truncated `if ($approval -notmatch '^[Yy]$')` in Setup-Quick.ps1.
- Removed accidentally duplicated second launch/try/finally block.
- Bumped standalone CMD's pinned source SHA to the repaired helper commit.
- Removed unsupported `navigate-to` token from PluginSandboxBridge meta-CSP, without changing sandbox isolation.
- Added Windows PowerShell 5.1 and 7 AST parser CI and Node tests of integrity/CSP.
