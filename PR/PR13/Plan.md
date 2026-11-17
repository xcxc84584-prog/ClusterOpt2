# PR13 Plan — Dynamic user-installed plugins

## Goal
Support user-authored plugins, but statically enforce the API surface and
permissions. No parallel plugin registry; URU owns runtime object/provider
identity, HubUnit routes calls and permissions, OMU audits, and EDPMU owns
global properties.

## Delivery sequence
| Sub-PR | Deliverable | Priority | Gate |
| --- | --- | --- | --- |
| 13.1 | Untrusted JSON package manifest and contract validation | P0 | Schema tests + VTE |
| 13.2 | Explicit local file/folder selection and package install | P0 | Gesture + atomic rollback |
| 13.3 | Worker isolation, message protocol and RPC bridge | P0 | CSP/browser tests |
| 13.4 | HubUnit capability ACL and user authorization | P0 | Deny-by-default |
| 13.5 | Timeouts, termination, failure EHU and recovery | P1 | Fault injection |
| 13.6 | Upgrade, disable, uninstall, dependency graph | P1 | No orphan references |
| 13.7 | CI/VTE/browser security regression | P0 | All event chains pass |
| 13.8 | IndexedDB package store, restore and export/import | P1 | Integrity and reload |

## PR13.1
A plugin package manifest is plain JSON with packageVersion, name,
relative entry path, and the existing Provider Manifest v1. Parse without
running any code, reject unknown fields and unsafe entry paths, and require
worker isolation for user-authored plugins. Provider Contract remains the
source of service declaration rules.

### Example
```json
{
  "packageVersion": 1,
  "name": "My Lexer",
  "entry": "dist/worker.js",
  "provider": {
    "manifestVersion": 1,
    "providerId": "author.lexer",
    "objectId": "Author.Lexer",
    "provides": [{
      "service": "editor.syntax.tokens",
      "action": "tokenize",
      "version": "1.0.0",
      "inputSchema": {"type": "object"},
      "outputSchema": {"type": "object"}
    }],
    "requires": [],
    "permissions": [],
    "execution": {"isolation": "worker", "concurrency": "per-slice"}
  }
}
```

## Threats and load
- Manifest at most 64 KiB; existing Provider Manifest limit is 32 KiB.
- Block traversal, absolute paths, URLs, backslash paths and executable
  metadata. Contract failure is fail-closed before registration.
- No capability grant on parsing; user approval at PR13.4.
- Package bytes, module graph, package hash/signature and storage limits
  require later PR13.2/13.3/13.8 validation.
- No unbounded scheduler or extra registration cache.

## Release
Sub-PR patches remain on one PR13 Draft branch. A major-PR release
requires version sync, CI, browser acceptance, and a backup ref before
merging main.

## PR13 Patch(+2) integration progress
- PR13.2: browser directory-handle intake with bounded manifest and entry
  reads. Returns staged data, does not execute code or register a Provider.
- PR13.3: RPC envelope contract validator for bounded request/response
  messages, ID correlation, declared service and action checks.
- PR13.4: immutable explicit approval review, deny Core and unknown grants.
- Host-only LinkCore staging method; no public untrusted invocation API.

### Acceptance still required
External plugin isolation/runtime and UI installation are incomplete.
A same-origin Worker is not an adequate untrusted-code sandbox.
Do not call 13.2–13.4 complete or grant untrusted plugins until an
isolated origin/channel and browser adversarial tests exist.

## PR13 Patch(+3) — whole-folder plugin portability
- File/folder project is the package boundary, not a precompiled single JS.
- Preserve all nested HTML/CSS/JS and binary resources as bounded base64.
- Maximum 128 assets, 2 MiB per file, 16 MiB total, 12 directories deep.
- Reject unsafe relative paths and files with inconsistent content.
- Add Resources > plugin bundle JSON export/import and IndexedDB snapshots.
- Persisted package records are intentionally disabled and unapproved.
- **Activation remains unavailable** until authenticated cross-origin or
  opaque-origin sandbox, CSP and per-call HubUnit ACL are verified.
- Package exports represent staged snapshots, not currently active
  third-party runtime instances. Bundled trusted providers require a
  separate verified export path before parity with active plugin list.

### Optional HTML frontend
Package Manifest may declare `uiEntry: "index.html"` alongside its JS
service entry. HTML/CSS/JS assets are preserved as inert data until the
sandboxed UI runtime is audited; no raw HTML is injected into main DOM.

## PR13 Patch(+4) — API Catalog + reviewed reload
- Replace API cards with a flat, six-column searchable API table.
- Derive Request payload / Response value from registered OCDA and
  Provider Contract schemas; missing legacy descriptors remain unknown.
- Route API, Property, Provider discovery through HubUnit with source
  checks and bounded pages, URU/EDPMU remain sole authorities.
- Retain trusted pre-reviewed shipped plugin state across reloads using
  separate IndexedDB reviewed records; do not auto-execute user code.
- Bundle exports include valid reviewed provider IDs + enabled flags.
- Add browser tests for table and reviewed-plugin reload.

## PR13 Patch(+5) — API protocol and author template
- Declare actual HubUnit core Request arguments / Response envelope in
  immutable HubProtocolPolicy, read through HubUnit Property.Read.
- Render protocol metadata in compact API List, without pretending
  undescribed legacy actions have schemas.
- Resources offers a bilingual downloadable ZIP authoring template.
- Package includes multi-file HTML/CSS/JS, plugin.json, README with
  explicit instruction to consult API List input/output first.
- Locale changes must alter the downloaded content, not only button text.
- Add ZIP format, contract and browser language-switch regression tests.

### API contract coverage addition
Expose only caller-authorized UserAPI/AgentAPI actions via
HubUnit.listActionContracts, with schema absent where legacy Objects do
not declare APIDescriptors. Never infer input/output from live data.

## PR13 Patch(+6) isolated host activation milestone
- User-confirmed local folder activation with independent capability
  review and Hub/URU registration transaction.
- Opaque-origin iframe with strict CSP and authenticated MessagePort,
  self-contained ES Module named Action exports only (initial slice).
- Every invocation passes through live HubUnit ACL, URU Provider state,
  and the ephemeral PluginPermissionUnit grant ledger.
- Timeout and failed RPC terminate sandbox and emit EHU; stop removes
  runtime handles and URU registration without a parallel registry.
- Browser security and CPU starvation gates remain pending before PASS.

## PR13 Patch(+7) — lifecycle (PR13.6)
- Host-installer uses live URU state to block dependent-provider disable
  and uninstall; UI managed toggles use guarded host APIs.
- Same-identity, explicitly approved upgrade attempts rollback to the
  old Provider, Object, sandbox and previously active grants on failure.
- VTE tests added; browser, CI and recovery checks pending. Upgrade UI,
  uninterrupted cutover and persisted package update are not yet done.

## PR13 Patch(+8) — lifecycle and persistence follow-up
- Deny cutover while active dependents have no alternative Provider.
- Persist upgraded package snapshot only after successful activation;
  remove saved package after successful uninstall.
- Add VTE dependency-cutover test and Chromium CSP/network adversarial
  test. All tests must pass again at final commit.
- Full web-folder execution and complete PR13.7/13.8 remain release
  blockers; do not merge until accepted.
