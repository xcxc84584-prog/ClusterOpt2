# PR21.4 Patch(+2) — host confirmation, vault browser test and package repair

Baseline main: `7008bd2484a98a2c1dd572ebd7ce1461a2ffbdba`; branch `feature/pr21-4-legacy-mcp-background-and-pair-ui`; release `0.0.15b` unchanged.

## Issues fixed
- `PluginUIHostUnit` now requests an explicit **trusted host confirmation dialog** before honoring an opaque-iframe request to use a saved pairing token. The token stays in the host; no URI, Hub Request or iframe message includes its contents.
- `TrustedPairingVault` browser regressions now exercise AES-GCM encryption at rest, non-exportable CryptoKey, reload persistence, migration from the original Cluster localStorage token, deletion and sandbox saved-state connection UI.
- `plugin-agent-download.js` downloadable ZIP now includes the MCP background scripts once each. Duplicate allowlist entries caused a 24-vs-26 ZIP file-count mismatch in CI; cleaned.
- `Quick-Setup.cmd` pins the reviewed Local Agent setup helper revision with the explicit private Token retrieval guidance, rather than an older build.
- MCP OneClick pinned asset revision verified: `01510a1f6f8216f2a0a6b976e3412f957119475c`; all eight required assets available and match current branch blobs.
- `local-agent/README.md` explains Status/Start/Stop, non-persistent Quick Tunnel URLs and user-configured stable HTTPS issuer.

## Tests
At `569a4aee` all five GitHub CI workflows PASS including Windows native MCP/OAuth, OCDA/browser. Later changes added the encrypted-vault tests and new host consent, causing an obsolete duplicate-ZIP regression; issue fixed in `3e3a7f33`. Final HEAD retest is pending.
Never report CI PASS for the final HEAD until GitHub reports success.

## Remaining
Verify latest CI; real user Windows HTTPS tunnel and ChatGPT MCP OAuth authorization need manual hardware/network acceptance. PR #72 stays Draft and main stays untouched until explicitly approved to merge. Token storage in browser is encrypted but has a same-origin script-threat limitation and is not equivalent to OS-user DPAPI.
