# PR9 — Plan
## Patch(+1) scope
Create a safe, page-bounded Go to Line feature using GoToLinePolicy registered only through LinkCore. Use existing textarea/UI style and Language Property. Provide a non-native dialog (not prompt) and Ctrl+G shortcut. Preserve editor bytes; update cursor, viewport and recovery snapshot consistently.
## Algorithm & examples
Target global 1-based line number is translated into current loaded page-relative line; locate newline positions without rewriting text. Line 1 begins at offset 0; trailing LF creates an addressable empty final line. For virtual page starting at global line 200, request 201 maps to the second resident line. Reject out-of-page requests with 416 and a localized message, pending full-document line navigation in later patch.
## EventChain
User click/Ctrl+G -> UI -> EDPMU GoToLinePolicy lookup -> resolve -> local editor viewport -> SessionRecovery queue -> HubUnit persist -> OMU.
## Performance
O(current loaded page text length) worst-case scanning; O(1) extra memory. No full-Blob read, no OS filesystem write, no extra workers or network traffic. This is deliberately NOT yet global virtual-document seek.
## Security
No key or machine-specific paths, no text eval, line integer and geometry validation, no background permissions.
## PR8 parallel review
Check viewport coordinate post-load clamping; sparse-index latency; close/save/reopen with browser permission revoke; Explorer directory actions 501; large-file crash and readback. Record findings rather than claim PASS.
## Remaining patches
Full-file virtual line seek, scroll coordinate lifecycle browser test, legacy Explorer parity, native PowerShell lifecycle, and PR8 independent acceptance.

## Viewport restoration refinement
Preserve saved scrollTop/scrollLeft/lineHeight in a one-shot pending
snapshot separate from cursor. A virtual file's async page load may
temporarily reset scrollTop; after text is painted, requestAnimationFrame
applies the saved browser pixels with line-height zoom compensation.
Never interpret caret offset as scroll position. Tests still needed for
large file restore after delayed permissions and reload.

## Patch(+2): Native PowerShell and line dialog placement
- Compare legacy ClusterOpt's PowerShellManager, PowerShellClient,
  PowerShell UI and local-agent/native-terminal.mjs before integration.
- The browser is an unprivileged UI; an explicitly paired, separately
  installed loopback agent launches genuine ConPTY PowerShell.
- PowerShellSessionManager Object owns independent logical sessions;
  PowerShellConnectionPolicy owns the protocol, 64-char pairing-token
  validation, loopback port and maximum sessions (8).
- The pairing token remains only in JS memory, never passed to HubUnit,
  persisted, exposed in a URL or logged. No HTTP command fallback.
- Native PowerShell pane uses the existing palette and inherits the
  old agent's WebSocket protocol. Multiple session tabs get separate
  WebSocket/ConPTY sessions; closing a tab destroys its socket.
- Go to Line dialog is constrained above the editor footer, including
  zoom and short window heights. PR9 Patch1 page-relative limitation
  remains until real cross-page line-index seek.
- Resource estimates: O(session count) DOM/PTY objects, capped at 8;
  browser scrollback per session 10000 lines. Native agent's own
  server enforces OS process and origin limits.
- Security: loopback only, explicit pairing, no remote host input,
  pairing secret not stored, and no implicit local system privilege.
- Browser tests must exercise native pairing using a synthetic WebSocket,
  then real Windows ConPTY acceptance separately.
