# PLUGIN PR02 — Relation Test
## PR02.01 Test Matrix
| Test | Source | Status |
| --- | --- | --- |
| v1 descriptor valid, deeply frozen | Node 22 unit | local 3 tests PASS |
| invalid version/type/size/permissions | Node 22 unit | local PASS |
| unsafe prototype / function / circular | Node 22 unit | local PASS |
| LinkCore property read via HubUnit | Chromium Playwright | pending CI |
| legacy Cluster API unaffected | Chromium Playwright | pending CI |
| full OCDA CI / regression | GitHub Actions exact SHA | pending CI |
| Relation: registered audit caller → Property | Chromium/OMU | pending CI |
| main recovery from backup SHA | GitHub refs | PASS, backup branch created |
| external API Catalog list/describe | PR02.05 | TODO |
| untrusted plugin runtime | PR06 | out of scope |

No claim of Catalog complete, routing/Provider activation,
real user disk permission or non-sparse 5 GiB save tests.

## PR02.01 Final Automated Acceptance
Exact-head commit `6a2ee4078c5c72cf9b1ef0cdbe94ef3063b31376`:
- [PLUGIN PR02 API Catalog](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020386526): **PASS**, Node descriptor tests and real Chromium LinkCore property E2E.
- [OCDA CI](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020386431): **PASS**, full Node checks and Chromium.
- [PR1 OCDA Verification](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020386725): **PASS**, existing regression.
- [Local Agent PowerShell Parse](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020386716): **PASS**, PS5.1/7 plus Windows ConPTY.

**PR02.01 result: PASS for executable API Descriptor Schema v1 scope.**
PR02.02–PR02.10 remain TODO. Entire PR02 remains **not merged**.

## PR02.02 — executable contract tests
- Node: actual LinkCore/URU registration, bounded descriptor snapshot,
  UserAPI request 200, unregister cleanup 404.
- Node: wrong owner/action/visibility and duplicate metadata return
  registration false with EHU 400.
- Chromium: register dynamic Object, describe validated immutable
  metadata via internal URU, actual Request 200, unregister 404.
- Check exact-head CI for both tests before declaring PASS.

## PR02.02 exact-head CI: PASS
Implementation commit `a7ba16a5859b0b428059cd71e5be401da6a637f9`.
- [PLUGIN PR02 API Catalog](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020847071): **PASS**
- [OCDA CI](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020847030): **PASS**
- [PR1 OCDA Verification](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020847024): **PASS**
- [Local Agent PowerShell Parse](https://github.com/xcxc84584-prog/ClusterOpt2/actions/runs/44020847100): **PASS**

Includes strict descriptor mismatch/duplicate EHU 400 and successful
Hub-mediated Request 200. This is not evidence of PR02.03–PR02.10.

## PR02.03 — acceptance matrix
| Case | Evidence | Status |
| --- | --- | --- |
| Schema type, owners, visibility, read/write, invariants | Node test | PENDING CI |
| Frozen detached descriptor | Node test | PENDING CI |
| Duplicate or mismatched EDPMU registration 400/409 | Node + EHU | PENDING CI |
| Real Hub property read and missing caller 404 | Node, Chromium | PENDING CI |
| Legacy registration without metadata unchanged | Node | PENDING CI |
| Browser legacy Cluster facade unaffected | Chromium | PENDING CI |
| Dedicated PR02 + OCDA + Windows exact-head | GitHub Actions | PENDING CI |
| Real user disk/5GiB save | Out of scope, no mutation | NOT RUN |

No PASS is claimed solely from a committed test source. The browser
remains loadable without the new metadata; main unchanged.

## PR02.03 Exact-head Acceptance
Commit da2672e8315afb64a8cd8255c0b49acbec587d02:
- PLUGIN PR02 API Catalog 44022150286: SUCCESS.
- PR1 OCDA Verification 44022150263: SUCCESS.
- Local Agent PowerShell Parse 44022150302: SUCCESS.
- OCDA CI 44022150256: SUCCESS.
- Recovery checkpoint: backup/plugin-pr02-sub03-da2672e.

## PR02.04 Matrix (CI pending)
| Scenario | Verification |
| --- | --- |
| Empty registration and legacy Property omitted | Node + Chromium |
| New Object descriptor immediately collected | Node + Chromium |
| New Property descriptor collected, not value | Node |
| Unregister removes next projection, prior snapshot detached | Node + Chromium |
| Frozen metadata, no dynamic handler execution | Node + Chromium |
| Existing Hub Request path and Cluster legacy facade | Chromium |
| Dedicated Node / Playwright / OCDA / Windows | exact-head CI PENDING |

## PR02.05 acceptance matrix (exact-head CI pending)
| Scenario | Node | Chromium |
| --- | --- | --- |
| Stable owner/name ordering and nextOffset | added | added |
| Ambiguous id 409, owner-qualified 200, absent 404 | added | added |
| API owner and term filters | added | browser list |
| Property owner filter without exposing values | added | not required |
| Invalid kind, oversized page, invalid selector 400 | added | added |
| Dynamic removal reflected on next query | added | catalog test |
| Original Cluster facade and API Request | catalog test | added |
| Exact-head PR02/OCDA/Windows | pending | pending |

## PR02.06 verification matrix (CI pending)
| Case | Expected |
| --- | --- |
| Guest sees only Public exposed API | 200, filtered count |
| Protected visible to owner/descendant | 200, no sibling leak |
| Private API visible only to owner | 200 owner / hidden guest |
| UserAPI-only / AgentAPI-only origin | independent exposure |
| Non-readable property | excluded despite Public visibility |
| Private/Protected Property per EDPMU owners | filtered |
| Invisible describe vs unknown descriptor | both 404 |
| Unknown source | 404 EHU, no lazy factory |
| Invalid command/context | 400 EHU |
| No raw value, handler execution, unsafe Cluster facade | no side effects |
| Exact-head Node/Chromium/OCDA/Windows | pending CI |

## PR02.06 failed-run diagnosis and repair
Exact-head f4d4b13 dedicated workflow 44025082253 FAILED: 3 Node
and 1 Chromium tests. Root cause: legacy caller had no strict OCDA
APIDescriptors, so CatalogCollection returned 400 rather than empty
metadata, causing protected query tests to fail. Repair: skip these
legacy objects in catalog, retain their URU registration and add
catalog-collection regression. Re-run full workflow; PASS pending.

## PR02.07 acceptance tests (exact-head CI pending)
| Scenario | Expected |
| --- | --- |
| 2.3.1 provides >=2.1.0 in stable major | compatible |
| 2.3.1 vs 2.4.0, 3.0.0 | incompatible |
| 0.4.7 vs 0.4.2 / 0.5.0 | compatible / incompatible |
| since newer than descriptor version | registration EHU 400 |
| oversized/noncanonical/unsafe numeric versions | invalid 400 |
| deprecated flag | reported, no execution permission change |
| Real Chromium descriptor and legacy Cluster | verified by e2e source |
| Dedicated Node/Chromium/OCDA/Windows | pending exact-head CI |
