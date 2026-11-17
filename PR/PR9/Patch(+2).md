# PR9 Patch(+2) — Native PowerShell & Go to Line layout

## Scope
- Native ConPTY PowerShell integration with existing ClusterOpt localhost agent.
- OCDA PowerShellSessionManager and shared PowerShellConnectionPolicy.
- Explicit short-lived pairing; no arbitrary browser command runner.
- Multi-session tabs (up to 8), each corresponding to an independent agent WS session.
- Compact dock, palette colors, bilingual notices, and terminal toggle.
- Move Go to Line dialog away from bottom editor/status bar.

## Known limitations
- This integrates with the old agent endpoint, but DOES NOT install or start a
  native Windows agent automatically. User must run/trust local agent.
- The browser terminal depends on xterm.js CDN and does not yet support offline operation.
- True Windows ConPTY behavior, locale switching, permission revocation,
  and end-to-end interactive tests remain to be verified on Windows.
- PR9 Go to Line only supports currently resident pages; global line jump
  requires further line-index integration.
- Explorer parity remains an independent task.
- This patch cannot be called PASS until CI and manual Windows acceptance.

## Relation test
Node tests cover session create/select/close, invalid session rejection,
policy port/token validation, Hub EHU log behavior, and independent
browser smoke tests once available.

## Rollback
Start from merged PR9 Patch1 main, SHA
04e9690a15c5eb10fdfe5c8f3d308ddb17b57315.
The PR9 Patch2 development branch remains isolated until BC.
