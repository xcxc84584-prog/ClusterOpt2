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

## PR23 current requirements revision — 2026-11-19 (authoritative)
**This section supersedes the earlier 23.1–23.7 phase matrix and any conflicting phase references above.** PR23 has **eight** stages. Runtime code in PR23.2 remains a preliminary contract-validation helper; phase completion is pending integrated acceptance.

| Stage | Required delivery | Acceptance |
|---|---|---|
| PR23.1 | Inventory **all current native UI components**, actual source paths, Object IDs, existing state & APIs | DOM-to-inventory completeness and missing-UI report |
| PR23.2 | Full high-freedom plugin-facing native UI API protocol (Req/Rep, ACL, layout semantics, lifecycle, rollback, event subscription, quotas) | Request/Response specifications and schema/security tests |
| PR23.3 | Implement **UICO**, the UI API Hub, and **UISP**, the reusable UI standard property | HubUnit → UICO dispatch → UI Object, plus EDPMU UISP registration; unit/relation tests |
| PR23.4 | Implement and expose UISP API for **each** UI Object | Every inventoried UI Object declares typed UISP projection and supported Request/Response |
| PR23.5 | Validate full API data and visibility in API List | Zero gaps for registered public APIs: input schema, output schema, permissions, errors, examples |
| PR23.6 | Gradually register all UI Objects and UISP projections via **UICO and HubUnit/URU/EDPMU** | Dynamic registration, unique identities, lifecycle and reload tests |
| PR23.7 | Static Request/Response VTE compatibility runner comparing old and new version contracts; **on startup run once in background when LinkCore authoritative version differs from previously opened version**, emit Log/EHU | Deterministic versioned snapshots, change classification, no user-document writes, retry policy |
| PR23.8 | Integrate UICO and UISP with HubUnit/OMU/URU and release gates | End-to-end routing, authorization, event/Log/EHU, CI/VTE/browser acceptance |

### UICO hub responsibility (clarification)
`Plugin → HubUnit → UICO → UI Object → UICO → HubUnit → Plugin`. UICO is the only **UI-domain dispatcher**; it does not replace HubUnit as the system's Req/Rep authority. HubUnit owns identity/permission checks, URU registration flow and OMU event/log/error reporting; UICO owns typed UI routing, UISP projection and UI-object adapter operations. All inter-Object requests still traverse HubUnit. To prevent routing recursion, the UI Object dispatch may use a HubUnit-managed internal Request with a trusted origin and transaction context; UICO must not bypass HubUnit ACL to mutate an unrelated Object. Build this explicit bridge in PR23.3/PR23.8.

### Static VTE compatibility contract (PR23.7)
- Capture **declarative Request/Response schema snapshots** for each authorized API at version N−1 and N, keyed by immutable action identity and contract version, not volatile runtime object handles.
- Compare Request acceptance sets and Response shapes: removed/renamed actions, required-property additions, type narrowing/widening, new/removed error states and permission changes. Classify breaking vs additive vs documentation-only; unknown/missing snapshots are `UNVERIFIED`, never automatic PASS.
- Execute synthetic old/new fixture pairs inside the existing VTE sandbox; do not invoke live effects. Record `eventId`, `chainId`, source/target, status and EHU for fail cases.
- Startup condition follows **last opened LinkCore version** (not last successful VTE result): persist last-opened version and last-tested version separately. On version change run one background test and mark failed tests for explicit retry. Do not rerun on every same-version reload. Include suite fingerprint and fallback if storage unavailable.
- No API key, absolute workstation path or test-only prompts in user UI.

## PR23.3 guarded milestone (partial)
UICO and UISP have been introduced and registered via LinkCore: strict UICO read-only `describe`/`list`; UISP immutable shared definition and descriptor validation. 12 PR23-specific Node tests reported PASS. No real UI adapters or mutation APIs are enabled. Full CI/VTE/E2E remains pending; see `Patch(+2).md`.

## PR23.4 definitive amendment — 2-bit UI API operation code (2026-11-19)

This section supersedes any conflicting PR23.4 authorization description above. Each UI Object must implement a UISP-facing API with **four 2-bit operation codes** (the 2-bit value identifies one operation; it is not a four-permission bitmask):

| UI operation code | Operation | Meaning | Mandatory restriction |
|---|---|---|---|
| `00` | Add / 增 | Add a new extension API owned by the plugin for the target UI Object | Only in an explicitly extensible namespace/slot, after HubUnit authorization |
| `01` | Delete / 刪 | Delete an API previously added by the authorized plugin | Cannot delete native UI APIs unless a separate explicit `ui.api.native.delete` authority is granted |
| `10` | Query / 查 | Query authorized APIs, signatures, metadata and their visibility | Filter by caller identity, visibility and ownership |
| `11` | Update / 改 | Modify an existing API extension's metadata/handler binding using versioned contract rules | Owner-scoped; native API modification requires separate explicit host grant |

**Namespace separation:** these UI-operation bits are `UIOperationCode` and must never be confused with the existing **RelationCode** `00` no interaction / `10` Request / `01` Response / `11` bidirectional. One describes CRUD operations; the other describes Object-to-Object interaction direction. Always include the field name, not an unlabeled two-bit literal.

**Authorization representation:** One request carries exactly one operation code; each caller's permissions are represented as an approved set of allowed operations/scopes. Two bits alone cannot represent arbitrary combinations of independent permissions. For an independent allow/deny matrix across Add/Delete/Query/Update, use four booleans/a four-bit permission mask in the authorization layer; keep the requested 2-bit code as the operation selector.

**Critical distinction:** `Add`/`Delete` here operate on **API extensions attached to a UI Object**, not creation/deletion of native UI elements. UI element Create/Remove follows separate UICO actions and permissions. Native API removal is deny-by-default even for a plugin that created UI controls. Revoking a plugin must remove only its owned extension APIs.

**Atomicity and safety:** bind actual caller identity at HubUnit; track API provenance `native | plugin` with immutable ownerId, apiId, revision and schema digest. Reject spoofed owner/provenance, duplicate API IDs, mutation of native definitions without special rights, dangling subscribers, version-incompatible schema and malformed payloads. Use expectedRevision optimistic checks, atomic register/unregister with URU, OMU success/failure logs and EHU for every failure. Do not grant permissions simply because API List exposes an action.

**PR23.4 acceptance:** for every inventoried UI Object, test all four codes with both authorized and rejected callers; verify plugin-owned Add→Query→Update→Delete round-trip, native Delete=403, unowned Delete=403, duplicate Add=409, missing API=404, stale update=409, rollback and reload cleanup. Tests must include HubUnit/URU/OMU Event Chain and VTE; browser E2E is required where UI behavior changes.

**Implementation status:** specification only in this amendment. Current UICO remains read-only and no new dynamic API mutation authority is activated.

## PR23.7 amendment — three independent VTE triggers
This supersedes earlier statements saying the automatic VTE runs **only** after a version change.

A background, static Request/Response compatibility test is requested when **any** of:
1. LinkCore-authoritative current version differs from the last opened site version.
2. The previous run left a relevant UICO API-contract or Event Chain failure, error, or unverified result.
3. The user explicitly runs `VTE.UICO_TEST` in the browser console.

Multiple simultaneous reasons combine into **one bounded single-flight run**; a manual call can force a recheck at the same version. Do not run after unrelated errors. The previous opened version, previous test outcome, test suite digest, and active run identity are separate records. Version changes still compare the previous published Request/Response contract snapshot against the new one; an absent baseline is UNVERIFIED, not PASS.

**Behavior:** nonblocking scheduling after application initialization; isolated fixtures with zero live UI/document mutations; serialized audit records through OMU. Complete with PASS Log if all required compatibility checks succeed, otherwise a failure Log/EHU. Failed runs remain eligible for retry at a later launch; do not repeatedly spin during one session. If storage is unavailable, do not invent an earlier version. Bounded and sanitized output, no user-visible debug UI.

**New implementation checkpoint:** `Implementation/property/UICOVTETriggerPolicy.js` is a pure, side-effect-free trigger-selection helper. `Implementation/tests/uico-vte-trigger-policy.test.js` has 7/7 Node tests PASS via X2 PowerShell (ExitCode 0). This is **not yet** an installed console command, background scheduler, static fixture runner, contract-diff engine or OMU wiring. Future integration must use existing VTE and LinkCore authority rather than a competing runtime.

## PR23.7 Patch(+5) runtime milestone
- Existing `exposeVTE(window, linkCore)` now exposes `VTE.UICO_TEST()`, returning a Promise of a bounded report.
- `UICOVTERunner` calls the existing detached `VirtualTestEnvironment`, checks a read-only HubUnit UICO request and verifies an unsupported mutation is denied; compares stored static action/capability signatures.
- Startup trigger decision uses LinkCore version and prior UICO VTE result; previous failure and explicit manual request run on unchanged versions. `localStorage` denial does not block console VTE.
- Missing old contract is UNVERIFIED with EHU; no native UI or document writes.
- IMPORTANT: This is **partial** static compatibility coverage. Full per-action Request/Response JSON schemas, UI inventory, VTE chained relation coverage, run persistence hardening, real-browser E2E and full CI remain pending. Current auto execution uses the existing VTE facade rather than a new authority.

## PR23.1 source-inventory milestone (Patch +6)
- Added `scripts/pr23-ui-inventory.mjs` and generated `PR/PR23/UI-Inventory.md` from the Draft repository's `index.html` plus `Implementation/main`, `object`, and `LinkCore` JS files.
- Current scan: 86 distinct static HTML IDs, zero duplicate IDs, 70 JS source files, 11 source files containing dynamic DOM creation/insertion patterns.
- Added `Implementation/tests/pr23-ui-inventory.test.js` to verify uniqueness, HTML ID coverage and honest unverified status; 3/3 Node tests PASS via X2 with exit 0.
- This is a **static source audit only**, not a complete native UI runtime inventory. Dynamic controls, plugin HTML, runtime states, responsive layout, per-UI UISP API, access scopes and API List coverage are still unverified.
- The inventory is a reproducible audit artifact, not a second UI Object/Property registry. Before PR23.4/23.6 implementation, reconcile the list against browser DOM and registered OCDA Objects, then update the inventory and the unresolved-issues list.
