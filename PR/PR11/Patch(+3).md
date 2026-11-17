# PR11 Patch(+3) — Real HubUnit Relation Test
- Added multilang-relation.test.js, using fresh LinkCore instances.
- Exercises URU Provider registration, HubUnit service resolution,
  Request/Response Log pair, and oversized failure EHU 413.
- Tests are run by the existing npm test glob, not a duplicate CI workflow.
- No new EDPMU property; global registry now records this.
- Browser E2E and complete VTE event-chain acceptance still pending.
