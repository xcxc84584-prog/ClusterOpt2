# PR13 Patch(+5) — Explicit HubUnit Req/Rep and plugin templates

## Scope
- PR13.7: migrated legacy Playwright API link tests to the new
  compact table and opened Plugin Manager through the actual menu flow.
- HubProtocolPolicy: immutable metadata for five actual HubUnit methods.
  Each declares Request arguments and Response envelope fields; payload
  value remains type "any" unless an Object/Provider specifies a schema.
- Registered HubProtocolPolicy exactly once as read-only Public Property
  using the existing EDPMU via LinkCore HubUnit.registerProperty.
- API List reads HubProtocolPolicy through HubUnit Property.Read.
  No direct plugin execution or parallel registration index is created.
- plugin-template-download.js: binary-safe ZIP STORE writer with CRC32,
  produces editable plugin.json, README.md, index.html,
  src/{worker.js,ui.js}, styles/main.css.
- Resources > Downloadable plugins: download a plugin-making template ZIP.
  Language is read at click from EDPMU's existing Language Property.
  The chosen ZIP filename, manifest name, code comments and README switch
  between zh-Hant and en. README directs developers to API List.
- Unit/VTE checks for manifest/Provider Contract, ZIP directory inventory,
  all core Req/Rep field metadata and immutability.
- Playwright browser download locale-switch acceptance.

## Architecture contract
HubUnit -> EDPMU -> HubProtocolPolicy -> API List (read-only metadata).
User authored service API -> ProviderManifestPolicy -> HubUnit -> URU.
No source execution from downloaded template, manifest or imported folder.
Static API/ACL limits remain mandatory; arbitrary folder execution
requires PR13.3/13.4 sandbox and per-call ACL before release.

## Pending security
- PR13.3 untrusted cross-/opaque-origin isolation and authenticated RPC.
- PR13.4 permission prompts pinned to provider identity/integrity,
  per-invocation HubUnit ACL.
- PR13.5 terminal EHU/timeout and PR13.6 arbitrary plugin lifecycle.
- PR13.7 complete browser adversarial acceptance.
- PR13.8 user-authored plugin auto-reload remains fail-closed.

## Recovery
Keep PR #58 Draft and retain backup/pr13-prestart-20261117.

## Patch(+5) coverage extension
- HubUnit.listActionContracts(source, options): enumerates only
  caller-authorized OCDA UserAPI/AgentAPI actions from URU live Objects.
  Hidden/private actions are not inferred or surfaced.
- API List now includes legacy user-callable Action rows with explicit
  "Not declared" input/output when APIDescriptors are absent; existing
  described Request APIs are deduplicated.
- HubProtocolPolicy documents listActionContracts alongside request,
  requestService, readProperty, discoverCatalog and Provider queries.
- Added VTE tests for unknown source, invalid pagination and hidden
  legacy actions; missing schemas remain null rather than fabricated.
