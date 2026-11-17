# PR19.1 Patch(+1)

- Fix `choice` stale ERRORLEVEL 1 when the installer directory already exists.
- Guard mkdir error check only when mkdir runs.
- Promote product release number to `0.0.15a`; sync two distribution package mirrors.
- Accept 0.0.15a in PowerShell installer filename validation.
- Add Node tests for CMD errorlevel ordering and version parity.
