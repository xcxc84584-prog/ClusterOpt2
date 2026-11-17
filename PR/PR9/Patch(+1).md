# PR9 Patch(+1) — Page-local Go to Line
## Changes
- New immutable GoToLinePolicy with 1-based line validation and CRLF/UTF-16-compatible offsets.
- LinkCore version 0.0.9-pr9.patch1, central property registration and registry entry.
- Inline accessible Go to Line dialog, Ctrl+G, locale strings for Chinese/English.
- Added Node unit tests for line addressing and off-page rejection.
## Security
No new external file permission, credentials or dynamic code execution.
## PR8 audit
Latest main PR8 Patch25-Fix2 documents unfinished scroll restore, directory operations and large-file acceptance. Continue PR8 regression independently.
## Verification status
Source implementation written on PR9 branch. Node/Playwright and OCDA relationship tests must be executed before PASS/merge.
## Rollback
main remains unchanged; delete the unmerged PR9 branch or revert its commits to return to PR8 Patch25-Fix2 baseline.
