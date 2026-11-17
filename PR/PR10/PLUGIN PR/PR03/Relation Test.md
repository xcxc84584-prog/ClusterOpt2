# PLUGIN PR03 — Relation Test
## PR03.01 acceptance
| Case | Expected | Evidence |
| --- | --- | --- |
| Canonical service IDs | 200 | Node unit |
| Mixed-case, unicode, @version, prototype, invalid separators | 400 | Node unit |
| Duplicate canonical service name | 409 | Node unit |
| Oversize list/identifier | 400 bounded | Node unit |
| Actual Hub readProperty in detached VTE | 200 Log, no dependencies | Node VTE |
| EDPMU single registration and browser API compatibility | PASS | Chromium |
| Dedicated Node / Chromium | exact-head GitHub Actions required | PENDING |
| Full Node/OCDA/PR1/Windows regression | exact-head required | PENDING |
| Provider registration / dynamic execution | PR03.02–09 | NOT IMPLEMENTED |
| Physical 5GiB file tests | out of scope | NOT TESTED |

## PR03.02 — Provider Manifest v1 acceptance
| Check | Expected | Status |
| --- | --- | --- |
| Complete valid provides/requires/permissions/execution | 200, frozen | Node |
| Wrong names, SemVer, nested input/output schema | 400 | Node |
| Duplicate provided services or self-dependency | 400 | Node |
| Cycles, functions, getter, pollution, excessive list | 400 | Node |
| Hub readProperty of single policy via detached VTE | 200 Log | Node |
| No provider execution or Dependency during validation | no REQ edges | Node + Chromium |
| Real browser schema + old Cluster.api/version | unchanged | Chromium |
| Dedicated PR03 + OCDA + PR1 + Windows exact-head | mandatory | PENDING CI |
| Provider registration, sandbox & route switching | out of scope | PR03.03+ |

## PR03.03–PR03.10 verification matrix
| Stage | Positive | Negative | Automated file |
| --- | --- | --- | --- |
| 03.03 URU bindings | 201, cleanup | 400/403/404/409 | provider-bridge.test.js |
| 03.04 EDPMU claims | owner write 200 | 403/404 EHU | provider-service.test.js |
| 03.05 ServiceRegistry | two candidates | invalid/unknown | provider-service.test.js |
| 03.06 trusted Factory | lazy materialize once | 403/404/409/500 | provider-lifecycle.test.js |
| 03.07 disable/dispose | other Provider unaffected | disabled 409 | provider-lifecycle.test.js |
| 03.08 compatibility | same major/schema | 409 contract mismatch | provider-lifecycle.test.js |
| 03.09 health | fault/cooldown/recover | 429, 503/504 EHU | provider-lifecycle.test.js |
| 03.10 real VTE | 00/10/01/11 graphs | no extra dependency | provider-lifecycle.test.js |
| Browser regression | old Cluster.api, UI | no lookup execution | plugin-pr03-integration.spec.js |
| ReleaseVersion | package/LinkCore/SystemVersion equal | CI fails on drift | release-version.test.js |

PR03.01 exact-head f501dc6a = PASS across five CI suites.
PR03.02 exact-head c21032a = PASS across five CI suites.
PR03.03–10 implementation requires latest exact-head Node/Chromium,
PR02 Catalog regression, OCDA, PR1 and native Windows CI before PASS.
Physical 5GiB browser I/O, malicious-plugin sandbox and active
REQ-route changes remain outside PR03.
