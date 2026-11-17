# PR02.07 — Version Compatibility & Deprecation

## Scope
Pure CatalogVersionPolicy for strict MAJOR.MINOR.PATCH, >= required
versions in a stable major; pre-1.0 minor pinned. Optional since cannot
be newer than descriptor.version; deprecated=true is informational
and never revokes HubUnit Request or expands permission.
Register-time contract validation rejects contradictory since values.
Browser-facing API remains unchanged; no automatic migration, dynamic
code loading or route modification.

## Tests
Implementation/tests/catalog-version.test.js — Node unit and real
LinkCore Request + EHU registration tests.
Implementation/e2e/plugin-pr02-version.spec.js — Chromium browser
registration, descriptor inspect and legacy facade.
Dedicated CI plus OCDA, PR1 and Windows exact-head checks.

Status: IMPLEMENTED, CI PENDING.
