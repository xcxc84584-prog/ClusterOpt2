# PR25 — 48 acceptance conditions

Legend: IMPLEMENTED = a code path exists; not final PASS.
PARTIAL = incomplete coverage; PENDING = not demonstrated.

| Module | Requirement 1 | Requirement 2 | Requirement 3 | Requirement 4 |
| --- | --- | --- | --- | --- |
| PR25 | PARTIAL Host vs Plugin taxonomy | IMPLEMENTED five live kinds | IMPLEMENTED ID/version/owner/capability/visibility | IMPLEMENTED state badges |
| AL02 | PARTIAL Request schema coverage | PARTIAL Response schema coverage | PARTIAL required/type/limit/default | PARTIAL error and recovery coverage |
| AL03 | IMPLEMENTED request examples | IMPLEMENTED Host vs Worker guide | PARTIAL success/denial examples | PARTIAL scopes and permissions |
| AL04 | IMPLEMENTED manifest sample | IMPLEMENTED Worker/UI/CSP guide | PARTIAL folder/Snapshot/install | IMPLEMENTED independent sample |
| AL05 | PARTIAL current plugin capability | PARTIAL read/owned/native distinction | IMPLEMENTED ACL/Scope/Session docs | IMPLEMENTED 403/409 examples |
| AL06 | PENDING Event payload/trigger inventory | PARTIAL subscribe/order | PARTIAL Session lifecycle | PARTIAL race/cancel/revision |
| AL07 | IMPLEMENTED bounded source paging | IMPLEMENTED summary-only page | IMPLEMENTED cursor/revision | IMPLEMENTED lazy descriptor |
| AL08 | IMPLEMENTED previous/next/size/index | IMPLEMENTED source search/filter/sort | IMPLEMENTED retained query/sort | PARTIAL race/scroll E2E |
| AL09 | IMPLEMENTED all-kind authorized export | IMPLEMENTED independent of page | PARTIAL contract content coverage | IMPLEMENTED count/SHA/revision |
| AL10 | IMPLEMENTED copy schema and SDK calls | IMPLEMENTED ID/version/content search | IMPLEMENTED contract checker; VTE UI pending | IMPLEMENTED OMU EHU/check result |
| AL11 | IMPLEMENTED URU/EDPMU authority | IMPLEMENTED live revision check | PARTIAL migration docs | IMPLEMENTED no schema guessing |
| AL12 | IMPLEMENTED 100/1000/10000 unit tests | PARTIAL concurrent mutation E2E | IMPLEMENTED hash/count/revision test | PENDING independent blind test |

## Blocking merge conditions
- Final exact-SHA CI/VTE/browser E2E must pass.
- Complete native and Worker-facing API contract inventory.
- Event lifecycle documentation from authoritative registration only.
- Full static source provenance coverage.
- Independent documentation-only plugin build and rollback acceptance.

Do not treat passing a subset of tests as 48/48 PASS.
