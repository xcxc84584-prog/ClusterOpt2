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
