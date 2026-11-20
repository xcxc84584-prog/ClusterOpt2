# PR25 Patch(+2) — Live UI, five-kind export and metadata

## Changes
- Migrated Plugin Manager API List to source-side paged query via
  HubUnit; Object, Service, Property, Event and Protocol categories
  have independent cursor sequences.
- Request/Response full descriptors load only on selection.
- Added one-click authorized JSON export for all kinds, SHA-256 and
  before/after catalog revision checks.
- Added source-grounded Worker SDK, package, permissions, lifecycle
  and error examples in Developer-Guide.md.
- Extended APIDescriptorPolicy with strict category, audience,
  rpcScopes, sourceLocation, recovery and bounded schema constraints.
- API summary conservatively distinguishes HostInternal/PluginPublic.
- Updated the legacy API List browser expectation to the new layout.
- Added existing facade export endpoint and updated facade test.

## Tests
Node tests: 100/1000/10000 cursor traversal, ACL, lazy describe,
source-location mismatch EHU, export count/hash and existing unit
regressions. CI and browser E2E must be checked on exact branch HEAD;
past test status is not evidence for a later SHA.

## Not accepted yet
AL02/03/04/05/06 comprehensive completeness, automatic source-map
and CI static mirror enforcement, fully evented VTE developer entry,
third-party blind test, performance budgets and all 48 conditions
need additional independent signoff. No merge without final CI.
