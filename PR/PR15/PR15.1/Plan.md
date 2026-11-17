# PR15.1 — AI Agent Resources Publication

## Scope
- List AI Agent MCP(ChatGPT) in the existing Resources downloadable catalogue.
- Generate a bounded, complete downloadable ZIP from the canonical same-origin plugin folder.
- Let users extract ZIP and choose the directory through the existing browser picker.
- Preserve human approval of all six plugin capabilities; never auto-run a local Agent or grant permissions.

## Verification
- Node contract: all 15 assets, plugin Manifest, ZIP bounds and package policy.
- Playwright: Resources search, ZIP byte entries and folder-mount action.
- Existing OCDA CI / Browser / Windows PowerShell checks.

## Security / Performance
The publisher has a fixed asset allowlist and 1 MiB per-file ZIP budget.
ZIP downloading never executes code or launches Windows processes.
Local Windows OAuth and key-at-rest security are not certified by this PR.
