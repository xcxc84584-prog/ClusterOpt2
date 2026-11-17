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
