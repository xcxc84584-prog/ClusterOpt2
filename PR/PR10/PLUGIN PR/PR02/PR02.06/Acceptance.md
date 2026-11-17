# PR02.06 — HubUnit Catalog Permission Projection

## Scope
- HubUnit controlled discovery for registered Object callers.
- Public / Protected / Private apply existing AccessPolicy semantics.
- UserAPI and AgentAPI declarations restrict API metadata visibility.
- Property metadata requires readable=true and authoritative EDPMU access.
- Filter BEFORE query, count, search and pagination.
- Hidden describe returns 404 like nonexistent descriptor (no name leak).
- No external window.Cluster API added; PR02.10 provides read-only facade.

## Acceptance
Node test catalog-visibility.test.js, Chromium plugin-pr02-visibility.spec.js,
plus exact-head dedicated CI, OCDA and Windows PowerShell regressions.
Security: no side effect execution and no raw Property values returned.
Status: IMPLEMENTED, CI PENDING.
