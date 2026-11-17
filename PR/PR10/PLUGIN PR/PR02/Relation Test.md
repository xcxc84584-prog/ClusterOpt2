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
