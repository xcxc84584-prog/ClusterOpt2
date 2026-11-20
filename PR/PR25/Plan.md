# PR25 — API Catalog / developer experience

## Goal
Developers must be able to discover and use declared, authorized APIs
without reading ClusterOpt2 source. Accept only descriptors registered
through the live URU and EDPMU; never synthesize undocumented schemas.

## Required acceptance
PR25 and AL02–AL12 contain 48 acceptance checks. A patch is not an
acceptance result. Merge is blocked until all checks pass VTE, CI and E2E.

## Current patch
- LiveCatalogPage scans authoritative runtime metadata and only returns
  bounded summaries (max 100 items) with nextCursor/snapshotRevision.
- describeLive fetches a single registered API descriptor after ACL.
- Revision changes invalidate old cursors with EHU 409.
- CatalogStaticGuard verifies explicit static descriptor versions. Each
  mismatch includes source repository file and line, actual/expected
  versions and a machine-readable EHU error code.
- 100/1000/10000 traversal and rejection tests are added.

## Current limits
The API List screen uses live server-side cursor pagination for Object,
Service, Property, Event and Protocol kinds. Other legacy resource views
still call the eager catalog helper and remain outside the PR25 migration.
Only explicitly registered Event descriptors are projected. Source locations must be explicitly supplied by the static
build manifest; runtime JavaScript cannot reliably infer source lines.
CI/E2E status must be evaluated on the exact final commit SHA.

## Performance and security
Target memory: O(registered summaries + one page of descriptor output).
The current live scan is O(N) per request and hashes each registered
descriptor. A bounded indexed generation will be required if benchmarks
do not meet latency targets. Cursor fingerprint is a change detector,
not a cryptographic hash. Full export MUST use SHA-256.
Authorization runs before result counts and pagination. No
permission elevation, system state mutation or secret exposure.

## Required follow-up
Complete automatic source-linked static build checks, fully enumerated
contracts, strict event lifecycle coverage, VTE developer tests and blind
third-party acceptance. Ensure all five required CI workflows and
cross-browser E2E pass on the final SHA before merge.
