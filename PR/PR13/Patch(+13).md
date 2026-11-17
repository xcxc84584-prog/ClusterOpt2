# PR13 Patch(+13) — Plugin Manager UI retention and template catalogue

## Problem / PRD
1. API List scroll continuously jumps to the top.
2. Downloadable plugin search input is destroyed while typing.
3. Authoring template has its own UI panel, obstructing plugin cards.

## Root cause
The host frequently calls pluginManager.refresh() when rendering tool
tabs. The previous refresh replaced all children of the main page,
destroying both the API table scroll container and the resource search
input. The author template was rendered outside the catalogue cards.

## Implementation
- Plugin Manager's external refresh now uses a state-aware, no-op
  reconciliation when view, language, selected Provider and Provider
  state are unchanged. Explicit tab switches, permission changes and
  API row selections still trigger a complete rebuild.
- Template is part of the existing PLUGINS catalogue with kind=template,
  translated searchable metadata and one ZIP download action.
- Template is never classified as a reviewed executable Provider:
  no install/mount button, no auto-registration, no permission grant.
- Remove the independent `pm-template-card` UI block to avoid overlap.
- Preserve language-specific ZIP filenames and the instruction to consult
  API List Request/Response contracts.

## EventChain / Relation tests
- Host tool refresh -> state snapshot -> unchanged -> preserve DOM
  identity, API List scrollTop and resource search value/focus.
- API tab user click -> explicit view transition -> fresh HubUnit API
  contracts and read-only table.
- Resources search -> filter catalogue cards (no Provider registry
  changes); template download -> bilingual ZIP, no execution.
- VTE/CI: new Playwright regression
  `Implementation/e2e/pr13-plugin-ui-refresh.spec.js`.
- OMU remains the authoritative Log/EHU source; this is UI-only.

## Acceptance
- API List and resource search controls survive tab refresh without
  losing their identity or state.
- Searching template/highlight filters the cards as expected.
- Author template appears once as a download card, no standalone UI.
- Full Node/VTE/Playwright and unified version-parity CI green.

## Version / recovery
No new public API and no release version increment in this patch:
ReleaseVersion remains the single authority at 0.0.15.
A pre-merge recovery branch must point to the final accepted SHA.
