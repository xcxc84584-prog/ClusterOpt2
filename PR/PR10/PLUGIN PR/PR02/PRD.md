# PLUGIN PR02 — HubUnit Self-Describing API Catalog
**Status:** IN PROGRESS; PR02.01–PR02.02 PASS / PR02.03 IMPLEMENTED (CI PENDING) / PR02.04–PR02.10 TODO.
**Source:** PLUGIN DESIGN PR LIST.md, PR02.01–PR02.10.
**Base:** main f16efc9d864b086423b6dedb3df1453cdd9c02bf.
**Rollback:** backup/pre-plugin-pr02-20261117.
**Branch:** plugin/pr02-api-catalog.

| Small PR | Scope | Status |
| --- | --- | --- |
| PR02.01 | API Descriptor Schema v1 & real LinkCore property | PASS (exact-head dedicated CI + OCDA + Chromium + Windows) |
| PR02.02 | Object Contract descriptor declaration | PASS (exact-head Node/Chromium/Windows) |
| PR02.03 | Property Descriptor Schema | IMPLEMENTED, exact-head CI PENDING |
| PR02.04 | URU/EDPMU Catalog collection | TODO |
| PR02.05 | read-only list/describe/query, pagination | TODO |
| PR02.06 | visibility/permission projection | TODO |
| PR02.07 | version/deprecation compatibility | TODO |
| PR02.08 | automatic JSON/Markdown docs | TODO |
| PR02.09 | VTE/EHU 400/403/404/409/413 | TODO |
| PR02.10 | read-only Cluster.api facade and browser acceptance | TODO |

**Rule:** One large PR at a time; each small PR must deliver a runnable,
committable complete feature with real Node/Chromium acceptance.
One merge to main after ALL PR02 integration gates PASS.
No custom route, Provider injection, or browser file write in PR02.01.

## PR02.03 status refinement (2026-11-17)
At exact head da2672e, four CI workflows passed; recovery checkpoint
backup/plugin-pr02-sub03-da2672e exists. PR02.03 = PASS.

## PR02.04 deliverable
Live internal CatalogCollection built from URU/EDPMU, bounded immutable
snapshots, no shared mutable index, no plugin-facing unauthorized API.
Implementation committed; exact-head CI acceptance pending.

## PR02.05 implementation scope
Internal CatalogQuery list, describe and query with bounded pagination,
validated selectors and ambiguity detection. Uses one current immutable
CatalogCollection result per call. No external discovery before PR02.06.
CI pending; PR02 large PR must remain Draft.

## PR02.06 scope
Registered-caller HubUnit discovery with CatalogVisibilityPolicy;
uses existing AccessPolicy and OCDA UserAPI/AgentAPI as authority,
EDPMU Property owner/readability constraints, and filters before counts.
Internal-only until PR02.10 facade; status IMPLEMENTED / CI PENDING.

PR02.06 regression repair: strict descriptor collection now excludes
legacy objects with no APIDescriptors, rather than failing a whole
source-scoped query. Previous CI failure acknowledged; new CI pending.

## PR02.07 implementation scope
API version comparison and deprecation metadata policy. No automatic
migration, command routing, access grant or stateful compatibility
cache. Full exact-head CI pending; main unchanged.

## PR02.08 implementation scope
Automatic bounded JSON and Markdown documentation generated through
source-filtered HubUnit discovery, never from raw registries. Returns
immutable in-memory text; no public browser facade or file write.
Status IMPLEMENTED / exact-head CI PENDING.
