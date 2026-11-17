# PLUGIN PR02 — HubUnit Self-Describing API Catalog
**Status:** IN PROGRESS; PR02.01–PR02.02 PASS / PR02.03–PR02.10 TODO.
**Source:** PLUGIN DESIGN PR LIST.md, PR02.01–PR02.10.
**Base:** main f16efc9d864b086423b6dedb3df1453cdd9c02bf.
**Rollback:** backup/pre-plugin-pr02-20261117.
**Branch:** plugin/pr02-api-catalog.

| Small PR | Scope | Status |
| --- | --- | --- |
| PR02.01 | API Descriptor Schema v1 & real LinkCore property | PASS (exact-head dedicated CI + OCDA + Chromium + Windows) |
| PR02.02 | Object Contract descriptor declaration | PASS (exact-head Node/Chromium/Windows) |
| PR02.03 | Property Descriptor Schema | TODO |
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
