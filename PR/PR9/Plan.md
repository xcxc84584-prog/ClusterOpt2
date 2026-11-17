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

## Patch3 revised user acceptance: old PowerShell 1:1
- Revert Patch2 custom PowerShell sidebar, restore old PSM module, native
  agent client and original UI CSS. Header button follows Explorer switch.
- Compatibility adapters expose the current shared Language/UI_COLOR to
  the legacy module, keeping all document state independently owned.
- Maintain original setup, multi-tab creation, terminal, settings and
  palette interfaces. Real Windows acceptance remains a separate gate.
- Risk: legacy PSM bypasses internal LinkCore Request/Response in its
  OS boundary; document as compatibility seam pending future formal wrapper.

## Patch(+4): final acceptance and versioned native installer
- Compare PR8 and PR9 PRD lists against actual editor, Explorer,
  native agent and CI tests. Record open P0/P1 items in dedicated
  FinalAcceptance reports, not as green status.
- Source of truth: LinkCore.SystemVersion. UI and generated CMD accept
  that value through explicit dependency injection.
- CMD loads current ClusterOpt2 install-current.ps1; local agent files
  are now vendored in the current repository, not ClusterOpt.
- Reject mismatched agent versions before native terminal connection.
- Preserve unrelated listener when port 43881 is occupied; choose
  another port or cancel.
- Security: loopback auth origin and token validation, no secret in repo.
- New tests: version/string/CMD download, loopback handshake rejection,
  regression and release-doc checklist.
- Windows native dependency install and 1/5 GiB benchmarks are manual
  acceptance gates beyond Linux CI; document them as NOT TESTED.

## Patch5: old ClusterOpt line toolbar with full-file seek
- Remove floating GoToLine dialog in favor of old dedicated flex-row
  #goLineBar between editor column and footer. The editor flex-shrinks
  rather than being overlaid, on both large and small screens.
- Resolve any positive, safe integer global LF line by bounded raw
  Blob windows, then load the selected source page and set caret/
  scroll. Valid trailing empty line is addressable; 416 for out of range.
- Use dirty and durable recovered page LF counts to rebase subsequent
  global lines; maintain original LF count cache for repeated jumps.
- Existing multi-page durable batch Save continues to own writeback.
- Real 1/5 GiB latency and Windows filesystem acceptance are still
  separate PR8 gates, never implied by 65 MiB Playwright green.

## Patch(+6) Windows native installer ParserError fix
- Diagnosis: the CMD succeeded at download; the PowerShell installer
  failed at ParseFile before any Node/npm operation. The first
  ValidatePattern regex was missing quote/closure and the entire
  installer code block appeared twice.
- Fix: a single well-formed installer; independent named functions;
  current SystemVersion passed into CMD and checked against
  current-repo manifest; local paths derived at runtime.
- Acceptance: AST syntax checking with both Windows PowerShell
  5.1 and PowerShell 7, no duplicate functions/body, no secrets
  written to disk, occupied port never forces process termination,
  current Node/npm discovery and original OCDA regressions.
- Security: Loopback 127.0.0.1 agent; no automatically granted OS
  privileges. No API key or constant token in source. The pairing
  token is shown only in the separate native console.
- Load: downloads three agent sources, optional portable Node zip,
  npm dependencies; installation serial, native process async.
- Manual Windows ConPTY pairing remains an independent gate.

## Patch(+7) user-requested occupied-port override
- Add P/C/O to the native installer only. O means terminate verified
  listener PID(s) after a separate explicit OVERRIDE confirmation.
- Warn that ordinary unrelated programs may be stopped and lose
  unsaved work. Resolve and display PID/Name/ExecutablePath.
- Refuse system processes, current installer/parent shells, known
  critical Windows process names and unidentifiable owners.
- Revalidate process CreationDate and live port ownership before
  force termination. Recheck port release before agent launch.
- Performance: one selected port, bounded CIM process lookups and
  20 x 250 ms post-stop polls; no background workers.
- Security: native privilege not elevated and no secrets or absolute
  machine paths committed. Existing browser HubUnit protocol intact.
- Test via Windows PS5/PS7 AST CI, OCDA Node tests, then cautious
  Windows process ownership/manual acceptance.
