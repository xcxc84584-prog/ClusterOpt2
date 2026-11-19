# PR23 Plan — Native UI Extensibility via UICO / UISP
Status: DRAFT (documentation only) · 2026-11-19
Scope: PR23.1–23.7 · OCDA / EDPMU / HubUnit / VTE

## 0. Authorities and non-goals
- Follow OCDA SOP: PRD → Plan → ArcD → Implementation + Relation Test → Project.
- Read latest versioned handoff and 全域屬性清單.md before **every** implementation change.
- Existing global authorities remain: URU = dynamic Object/Provider registrations; EDPMU = shared property definitions; HubUnit = Request/Response/Property routing and ACL; OMU = Log/EHU/Dependency; LinkCore ReleaseVersion.js = single release authority.
- Do not expose private browser handles, credentials, arbitrary DOM execution or cross-plugin state bypass.
- This PR does not redesign the UI or ship functional code. The inventory must be verified against the live UI before implementation. Do not advertise undocumented APIs as implemented.
- **Naming decision:** UICO = UI Control Object, UISP = UI Standard Property. PR23.7's “UICU” is treated as a typo unless a separately defined unit is approved.

## 1. Goals and concrete use cases
Enable authorized plugins to discover and safely customize native UI: geometry, z-order, typography, palette, layout, visibility, focus, tabbed windows, buttons, menu items and controlled navigation.
Examples: (A) create a toolbar button → click → open a plugin-owned sandboxed subpage; (B) create a tabbed settings window resembling Plugin Manager, with persistent local preferences; (C) recolor editor chrome without overwriting global UI_COLOR; (D) restore a plugin window after page reload subject to reauthorization.
Properties describe state and algorithms; UICO exposes bounded Requests and emits Responses/events. Plugins **never** mutate core DOM directly.

## 2. PR23 delivery matrix
| Sub-PR | Deliverable | Acceptance gate |
|---|---|---|
| 23.1 | Inventory **every** UI region and event with stable UI IDs, ownership, current source file, selector, state, coordinate source, accessibility, shared properties and API coverage | Reconciled DOM inventory; missing entries/legacy exceptions recorded |
| 23.2 | Versioned UI API protocol + schemas, ACL, lifecycle, transactions, subscriptions and coordinate system | Schema/denied-caller tests and documented Request/Response examples |
| 23.3 | UICO Object + UISP reusable EDPMU Property, separately implemented | Unit + Relation Test; no second property authority |
| 23.4 | Incrementally register existing UI objects/properties through URU → HubUnit | Unique IDs, idempotent registration, migration tests for each UI group |
| 23.5 | API List exposes all authorized contracts, input/output schemas, permissions, defaults, errors and versions | Coverage report = registered surface vs documented surface, zero missing public contracts |
| 23.6 | Version-change-triggered background VTE contract and event-chain tests | One run per *different* authoritative release version per browser profile, nonblocking, persisted last-success status; fail EHU |
| 23.7 | Integrate UICO/UISP with HubUnit and existing Plugin Manager, UI_COLOR and Language | Browser E2E, regression, permission, rollback, performance and accessibility gates |

## 3. PR23.1 UI inventory template (discovery, not claims)
Record for each component:
`uiId | objectPath | sourceModule | selector/renderer | parentId | owner | zLayer | coordinateSpace | x/y/width/height | layout | styleTokens | visibility | focus | events | accessibility | locale | persistentState | permission | API requests/responses | registrationState`.
Starting groups to inspect: shell/header; File/Tool menus; editor and tabs; Explorer; Project Tool; PowerShell; AI Agent; Plugin Manager (Plugin List/Permissions/Resources/API List); backup dialog; palettes; language/settings; toast/alerts/progress; modal/window manager; plugin content host. **Verify actual presence and file paths**; do not infer them.
Stable IDs must be runtime-independent; no untrusted CSS selector as Object identity. Store source maps in the inventory table.

## 4. PR23.2 protocol v1
Canonical routing: `Plugin.Object.Request.Action(payload)` logically routed by `HubUnit`; no SendTo().
Envelope proposal:
`{protocol:"cluster.ui/1", requestId, callerId, targetId, action, payload, expectedRevision?, deadlineMs?}`
Response:
`{requestId, eventId, status, ok, revision?, data?, error?:{code,message,details?}}`.
HubUnit pins trusted caller identity; never trust callerId from untrusted payload. Unknown ID/action/schema ⇒ 400/404; unauthorized ⇒ 403; stale revision ⇒ 409; timeout ⇒ 408/504; rate limit ⇒ 429; internal ⇒ 500; success ⇒ 200/201. OMU logs source/target/eventId/status and emits EHU for failures. Response must not disclose inaccessible UI state.
Requests:
- `UI.List`, `UI.Describe`, `UI.GetState`, `UI.GetProperty`
- `UI.Create`, `UI.Update`, `UI.Remove`, `UI.Batch` (atomic validation/rollback)
- `UI.SetVisibility`, `UI.SetFocus`, `UI.OpenWindow`, `UI.CloseWindow`
- `UI.AddTab`, `UI.RemoveTab`, `UI.NavigatePluginView`
- `UI.Subscribe`, `UI.Unsubscribe` (bounded events, cleanup on unload)
Responses/events: `UI.Created`, `UI.Changed`, `UI.Removed`, `UI.Activated`, `UI.NavigationRequested`, `UI.Error`.
Separate declarative actions from executable code. Callback handlers use registered action IDs and HubUnit routes; never inline JS/eval.

## 5. UISP schema v1 (reusable property namespace)
- Identity: id, kind, owner, parent, revision, lifecycle, schemaVersion.
- Geometry: coordinateSpace (viewport/window/content), x/y, width/height, min/max, transform, anchor, scrollX/Y, clipping, pixelRatio, responsive constraints.
- Layout: display, flex/grid constraints, direction, alignment, gap, padding, margin, order, overflow, resizable, draggable, snap.
- Appearance: token-based background/foreground/border/shadow/radius/opacity; typography; icons; hover/focus/disabled/active states; animation and reduced-motion.
- Content: textKey, localizedText, tooltip, iconRef, contentSlot; sanitized rich text where permitted.
- Interaction: enabled, visible, focusable, tabIndex, hotkey, pointer policy, registered action IDs, event subscriptions.
- Window: modal, docking, maximize/minimize, zLayer, tabs, activeTab, persistence policy.
- Accessibility: role, accessibleName, ariaState, keyboard navigation, contrast.
- Resource budget and security: ownership, quotas, allowed host slot, DOM isolation, revocable capability, expiry.
UISP definitions registered once via EDPMU; instances have per-Object values and explicit Property isolation/visibility. Shared UI_COLOR and Language remain canonical, not shadowed.

## 6. Security, loads and parallelism
- Default deny; distinct capabilities `ui.read`, `ui.create.own`, `ui.update.own`, `ui.insert.slot`, `ui.style.token`, `ui.window`, `ui.navigation`; privileged native modification requires explicit host approval.
- Public/Protected/Private visibility and Relation Code use the *current* OCDA ACL; privileges are not inferred from a declaration or presence in API List.
- Plugin HTML in isolated iframe/origin, content sandboxed, no privileged parent document access or arbitrary network/FS.
- Apply owner-scoped DOM mounting; namespace IDs, CSS, events; protect host toolbars and controls from overlay/obstruction; accessibility and input focus gate.
- Reference budgets (finalize via profiling): ≤100 plugin-created controls per plugin; ≤10 live UI subscriptions per plugin by default; batched updates ≤50 nodes and ≤16 ms target render budget; bounded payload ≤64 KiB; debounce fast-changing geometry events. These are *proposals*, not measured limits.
- Parallelize independent descriptor validation and read-only queries; serialize conflicting UI mutations per target / transaction. OMU eventId and EHU correlation must be preserved.
- Release changes are published only by LinkCore; drafts do not bump the product version.

## 7. Version-triggered VTE (PR23.6)
On startup, read authoritative LinkCore version; compare with last **successful** verified version and test-suite fingerprint stored locally. If unchanged: skip. If different: enqueue one nonblocking VTE run (single-flight) after initialization, with backoff, cancel/retry; do not block editor startup. Run schema contract tests for each declared Request/Response, permitted/denied relation cases, property visibility, stale ID, Event Chain, rollback, serialization, plugin isolation and 404/403 failure paths. VTE sandbox must not alter real documents or UI.
Record: releaseVersion, suiteVersion, runId, timestamps, contract coverage, PASS/FAIL, per-case status, eventIds, EHU, failure details, retry state. Only mark last-success version on all required PASS; failure produces EHU, and retains pending retry. Repeated same-source successful OMU logs may be cooled for 1s; failure/EHU are never suppressed. Allow explicit developer-triggered run irrespective of version; do not expose test banners to users unless designed.
Synthetic VTE cannot replace real-browser E2E for drag/focus/iframe/CSP/performance.

## 8. Acceptance and delivery controls
- For each migrated native UI group: snapshot visual layout, assert equivalent existing behavior, API discoverability, i18n + UI_COLOR compatibility, DOM stability and no layout overlap.
- Tests: schema Unit, Hub/URU/EDPMU Relation, VTE all event chains, actual browser E2E, keyboard/a11y, error injection, concurrency, reload/unload, CI.
- Track PR23.1 inventory and unresolved tests in `未完成測試/問題清單`; keep each Object and Property in separate files.
- Maintain `PR/PR23/Plan.md`, `ArcD.md`, numbered Patch(+x).md and versioned handoff on each implementation patch. A restorable recovery ref + passing checks is mandatory before merging the major PR. No keys, absolute paths or development banners in user-facing UI.

## PR23.2 implementation checkpoint — 2026-11-19
- Added data-only `Implementation/property/UIProtocolPolicy.js`, immutable contract validator and action/capability metadata; it is NOT an authority and does not mutate UI or grant permission.
- Added eight Node regression tests (8/8 PASS in X2 PowerShell isolated test). Full repo CI, real HubUnit integration, VTE and browser E2E remain pending.
- See `Patch(+1).md` and `總工作交接提示詞(PR23.2-draft1).md`. This patch stays on draft branch; release version unchanged.
