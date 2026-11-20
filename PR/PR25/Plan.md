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
The legacy Plugin Manager API List still eagerly aggregates complete
contracts and remains subject to a 4096-entry limit. The new API page
path does not yet replace this UI or cover all Service/Event/Protocol
classes. Source locations must be explicitly supplied by the static
build manifest; runtime JavaScript cannot reliably infer source lines.
No CI/E2E result can be assumed without the exact commit SHA.

## Performance and security
Target memory: O(registered summaries + one page of descriptor output).
The current live scan is O(N) per request and hashes each registered
descriptor. A bounded indexed generation will be required if benchmarks
do not meet latency targets. Cursor fingerprint is a change detector,
not a cryptographic hash. Full export MUST use SHA-256.
Authorization runs before result counts and pagination. No
permission elevation, system state mutation or secret exposure.

## Required follow-up
Wire UI navigation to source-side filters, extend descriptors to all
categories, add complete export with SHA-256, lifecycle and scoped
permissions examples, source-linked static build checks, VTE endpoint,
developer blind test, rollback and E2E under the current branch.
