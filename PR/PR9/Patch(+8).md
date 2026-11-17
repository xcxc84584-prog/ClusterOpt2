# PR9 Patch(+8) — Native Terminal Viewport and Detached Agent

## User defects
1. Terminal input was rendered at the bottom behind the site UI. Native
   terminal layout used fixed estimated glyph sizes, an absolute pane
   and a nonshrinking terminal wrapper. Scroll/resize diverged.
2. Disconnection message rendered literal escaped backslashes
   (\\r\\n) instead of real CR/LF terminal control characters.
3. The downloaded CMD stayed open and the user needed to preserve
   access to the Local Agent port and pairing token after setup.

## Implementation
- Keep the original ClusterOpt PowerShell toolbar and tab layout.
- Load xterm FitAddon 0.8.0 for xterm 5.3.0. Use FitAddon.fit
  instead of estimating 8px columns/17px rows.
- ResizeObserver reacts to actual native wrapper/container geometry;
  resize requests use validated terminal cols/rows and the currently
  active session. Disconnect observers on session disposal.
- Connected terminal pane and wrapper are shrinking flex children
  min-height:0, overflow:hidden. The old in-browser input/output
  strip is hidden; xterm is the only input surface.
- Replace escaped backslash-r/backslash-n strings with real CR/LF.
  Distinguish agent HTTP connection from native ConPTY socket status.
- The installer validates that node-pty native code actually loads
  after npm install; if blocked, abort with a diagnostic rather than
  reporting a falsely ready terminal.
- Installer generates cryptographic 32-byte token, passes it to
  its independently launched hidden Node process, removes its own
  environment copy, checks bound loopback port and prints port/token
  once locally. The Node process deletes inherited token from its
  environment before creating PowerShell child processes.
- The user copies port and token, presses Enter, then the installer
  and generated CMD exit while the Local Agent stays in background.
- No token written to disk or a stdout log; closing installer before
  copying token requires restarting/pairing again.
- SystemVersion comes from LinkCore and advances to
  0.0.9-pr9.patch8. Manifests mirror that value.

## EventChain, permissions and costs
UI -> legacy PowerShellManager/Client -> authorized WS ->
Local Agent -> ConPTY. UI resize is internal observer ->
FitAddon -> authenticated WebSocket resize frame; each
session has its own observer/socket and lifetime checks.
Native bootstrap is an explicit user OS action outside HubUnit;
its token never enters OMU/EHU logs or a repository file.
Cost: a bounded ResizeObserver per live xterm session and
a single animation-frame resize batch. Max sessions unchanged.

## Testing and acceptance
- Node structural regression covers viewport, real CR/LF, detached
  hidden process, token handoff, CMD success and failures.
- Windows PowerShell 5.1 / 7 syntax and installer structure checked.
- Browser geometry test uses a connected native pane without
  executing host commands; checks no overlap with footer.
- Native Windows ConPTY, npm install-script policies, closing CMD
  with connected browser sockets and shell job state require
  real-Windows acceptance after deployment. Do not mark PR9
  full PASS from CI only.
