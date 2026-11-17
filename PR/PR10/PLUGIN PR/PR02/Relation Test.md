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
