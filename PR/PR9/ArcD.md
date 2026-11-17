# PR9 — ArcD
## Property
GoToLinePolicy (Public, immutable, LinkCore-owned), uniquely registered with EDPMU and listed in 全域屬性清單.md.
## Objects
Existing UI/Workspace/SessionRecovery/LinkCore only. No duplicate Object or new direct cross-Object channel.
## Abstract architecture
User UI -> EDPMU[GoToLinePolicy] -> editor view (resident page) -> queueRecovery -> HubUnit -> SessionRecovery -> IndexedDB.
## Event Chain
1. GoToLinePolicy.validate line and lineHeight; local return (offset, scrollTop).
2. UI places caret and viewport without changing document bytes.
3. QueueRecovery submits SessionRecovery.persist through HubUnit.
4. OMU observes persistent Req/Rep, EHU and failed requests.
## Relationship / EHU matrix
| Source | Target | Relation | Pass | Fail |
| --- | --- | --- | --- | --- |
| ui | EDPMU:GoToLinePolicy | read | Property accessible | 403/404 on policy refusal |
| ui | session-recovery | 10 (request) | snapshot persisted 200 | 4xx/5xx EHU |
| session-recovery | workspace | 10 (request) | snapshot 200 | 4xx/5xx EHU |
Invalid local line address: UI-rejected 400 or 416; it is not an inter-Object Request, so does not forge a Hub EHU.
## Parallelism
Per-page line resolution synchronous and bounded. Recovery is debounced/serialized to avoid stale snapshot writes, independent of PR8 slice-load workers.
## Known limitations
No cross-page virtual seek, no OS-file access in GoToLinePolicy, no claim of full PR9 completion.

## Additional viewport EventChain
SessionRecovery.restore -> HubUnit -> Workspace.restore -> virtual page
load -> Workspace.onChange -> UI render -> animation frame -> viewport.
Guard active document identity and loading status; do not restore
offscreen inactive tab into the visible editor.

## Patch(+2) OCDA addition
Object: PowerShellSessionManager (independent file, Public)
Property: PowerShellConnectionPolicy (independent file, Public)
Cross-Object chain:
UI -> HubUnit -> PowerShellSessionManager
 -> read EDPMU PowerShellConnectionPolicy -> Response -> OMU
Browser-side native bridge:
UI -> authenticated loopback WebSocket -> old Local Agent -> ConPTY.
The native bridge is an external OS boundary, not an unregistered Object
interacting with LinkCore internals. No secrets enter OMU.
| Event | PASS | FAIL | EHU |
| --- | --- | --- | --- |
| Session.create | 200 | 429 limit | Hub records |
| Session.select/close | 200 | 404 unknown | Hub records |
| Session.closeAll | 200 | none | Hub records |
| Connection pairing | local validated | invalid token/port | no token logged |
| Native socket connect | ready | unavailable/unauthorized | sanitized UI EHU |
Parallelism: independently keyed sessions may run in parallel at the
external native agent; no synchronous shell operation in browser main.

## Patch3 compatibility architecture
UI toolbar #explorerPowerShell -> legacy mountPowerShellUI
 -> legacy PowerShellManager -> legacy PowerShellClient
 -> browser WS ws://127.0.0.1:43881/terminal/ws
 -> original ClusterOpt Local Agent -> native ConPTY

Current LanguageManager -> read-only locale subscribe adapter
Current UI_COLOR palette -> CSS tokens / MutationObserver adapter
Current FileWorkspace document render -> PSM syncTabs() (separate tabs)

Removed Patch2 PowerShellSessionManager and PowerShellConnectionPolicy;
no second native terminal, no duplicate OS execution path.
Security contract: browser retains no local privilege, all terminal
commands require explicit existing agent pairing and native socket.

## Patch(+4) version consistency chain
LinkCore.SystemVersion -> UI injection -> legacy PowerShell setup
 -> createSetupCmd(version) -> ClusterOpt2 install-current.ps1
 -> CLUSTEROPT_AGENT_VERSION environment -> native agent /status
 -> PowerShellManager.checkConnection expectedVersion
 -> Connected only if matching version + correct pairing.

This version read is immutable and central. No new HubUnit Property.
The installer is an external explicit user action and cannot grant
browser code OS execution permissions. No outgoing telemetry is
introduced. Safe port choice does not terminate unrelated processes.

## Patch5 EventChain, dependencies and EHU
User click old #goLineButton / Ctrl+G
 -> UI / GoToLinePolicy validation
 -> HubUnit [ui -> workspace.gotoLine]
 -> HubUnit [workspace -> VirtualFileDocument.seekLine]
 -> EDPMU GlobalPageLinePolicy raw bounded scan (no full decode)
 -> VirtualFileDocument.loadPage / PieceTree + BPlusSliceIndex
 -> Response [VirtualFileDocument -> workspace -> UI]
 -> textarea caret + line gutter + SessionRecovery snapshot.

Failures: 400 invalid line or geometry; 416 beyond EOF; 409 external
fingerprint conflict with unsaved edits; 422 truncated source chunk;
503 I/O failure. HubUnit logs unsuccessful Request/Response as EHU.
Document Load/Save authority and the old PS UI are unchanged.

## Patch(+6): installer/EventChain security boundary
UI[SystemVersion] -> createSetupCmd(version) -> CMD
 -> PowerShell install-current.ps1 ExpectedVersion [ValidatePattern]
 -> Download-AgentFile (ClusterOpt2 main only)
 -> read package.json / exact version comparison
 -> Find-Node or Install-PortableNode
 -> Install-Dependencies
 -> Select-LoopbackPort (cancel or alternative port)
 -> native agent process and console pairing
 -> existing browser PowerShellClient /status version handshake.

The native installer is external OS execution explicitly initiated
by the user; it does not claim registration as an OCDA browser Object.
HubUnit continues to own browser-side registered Object/Property
Request/Response. PSM pairing and native console are security
boundaries and never place the secret in OMU logs.

| Condition | Expected code/result | Observability |
| --- | --- | --- |
| Installer AST invalid | GitHub Windows CI FAIL | CI failure |
| Version fails pattern | validation failure | CMD nonzero exit |
| Manifest mismatch | installation abort | terminal error |
| Node/npm absent | portable fallback or abort | terminal error |
| Port occupied | select another or cancel | no process killed |
| Native startup fails | nonzero error / timeout | terminal error |
| Agent version mismatch | client rejects Connected | UI EHU |
| Agent authenticated | existing 200 / WS authorized | Hub Log |

The parser CI can run independent Windows OS versions in parallel.
Local download and npm stages stay serial to avoid corrupted installs.

## Patch(+7) Port ownership event chain
Explicit user native console input P/C/O
 -> Select-LoopbackPort
 -> Get-PortListeners(Port) [Get-NetTCPConnection]
 -> if P: validate alternate numeric port; loop
 -> if C: return error without termination
 -> if O: Release-OccupiedPort [CIM owner identity]
 -> print PID/Name/Path + warn user of unsaved changes
 -> Read-Host OVERRIDE (second, exact confirmation)
 -> recheck Owner PID/CreationDate/Name and listeners
 -> Stop-Process -Force on verified owners only
 -> bounded loop verifies port released
 -> Select-LoopbackPort -> native Agent launch.
A refusal/identity change/partial release aborts startup; errors are
reported locally and never forged as successful HubUnit responses.

The installer process sits outside browser OCDA runtime. Browser
PowerShellClient still pairs only with a verified loopback agent;
HubUnit Req/Rep, OMU Log/EHU and VTE remain unchanged.

## Patch(+8): native terminal viewport and detached setup EventChain
Source: UI SystemVersion -> generated CMD -> installer
 -> current-repo manifest validation -> verified native node-pty
 -> RandomNumberGenerator(32 bytes)
 -> child env CLUSTEROPT_PAIRING_TOKEN
 -> Start-Process node -WindowStyle Hidden
 -> Agent consumes and deletes env token
 -> loopback HTTP+WS server listening
 -> installer prints port/token once and waits for Enter
 -> CMD exits; native process continues independently.
The separate native OS boundary remains user-initiated; no token
moves through browser HubUnit, OMU Log or EHU.

Runtime:
PowerShell tab -> PowerShellClient authenticated WebSocket
 -> native-terminal.mjs -> ConPTY.
xterm ResizeObserver -> requestAnimationFrame
 -> FitAddon.fit -> WS resize(cols,rows) -> ConPTY resize.
Each tab's native socket, observer and terminal are isolated and
disposed on close. Width/height resize is bounded to the active
visible session. Native disconnect updates the native-specific
status instead of claiming a healthy terminal.

| Operation | PASS | Fail/EHU |
| --- | --- | --- |
| Native add-on import | native pty spawn available | npm setup abort |
| Detached background startup | loopback owner PID matches child | timeout/exit abort |
| Agent handshake | correct version and bearer token | 401/version mismatch |
| Native socket | ready and interactive | WS close/error displayed |
| Resize | measured valid geometry | invalid/offscreen skipped |
| Installer token | copied before user exits | must reinstall if lost |
| Tabs | independent fitted native session | dispose on close |

Parallelism: the browser's different terminal sessions run
independently via distinct WebSocket/ConPTY objects. Layout observers
coalesce into animation-frame callbacks and do not read document bytes.

## Patch(+9) native probe dependency chain / EHU
Native installer user action (outside browser HubUnit)
 -> Validate SystemVersion against downloaded package.json
 -> npm install {allowScripts: node-pty@1.1.0 only}
 -> npm rebuild node-pty (recovery from previously blocked script)
 -> node probe-native.mjs
 -> import node-pty and spawn Windows ConPTY powershell.exe
 -> check exit status and timeout
 -> P/C/O port selection -> detached agent.
Failures in native dependency chain cause a nonzero installer exit
and never report an authenticated browser connection. Browser-side
PowerShellClient/HubUnit EventChain, OMU/EHU and VTE tests are
unchanged. The test runs a short, noninteractive native shell,
never a user-provided command or script.
