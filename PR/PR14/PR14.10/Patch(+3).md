# PR14.10 Patch(+3) — Chromium acceptance repair

At the first PR14.10 integration checkpoint:
- Node/VTE Unit, PR1 Verify and Plugin Provider Node: PASS.
- Windows PowerShell 5.1/7 and native ConPTY: PASS.
- Chromium browser regression: 4 FAIL, 3 distinct causes.

Fixes:
1. ToolBox E2E installation approvedPermissions now includes shell.execute
   and mcp.read, matching the revised six-capability Manifest.
2. MCP and shell UI tests wait for confirmed agent connected status
   before enabling a bridge; visibility of the status node is not enough.
3. A denied PowerShell tool_result now explicitly carries approved:false,
   while other denied tools return error, matching the legacy protocol.

Final CI rerun required. This does not replace real Windows local Agent,
OAuth issuer or credential at-rest testing.
