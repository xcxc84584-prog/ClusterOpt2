# PR1 Relationship Test Matrix

| Test ID | Event Chain | Expected result | Automated test |
| --- | --- | --- | --- |
| RT-01 | UI -> Hub -> Workspace -> FileDocument -> load | 200 | documents.test.js |
| RT-02 | UI -> Hub -> Workspace -> FileDocument -> save | 200 | documents.test.js |
| RT-03 | Unknown sender -> Hub | 404 + EHU | linkcore.test.js |
| RT-04 | Unknown receiver -> Hub | 404 + EHU | linkcore.test.js |
| RT-05 | Duplicate Object ID -> URU | 409 + EHU | linkcore.test.js |
| RT-06 | UI -> private endpoint | 403 + EHU | ocda.test.js |
| RT-07 | Parent.Child -> Protected property | 200 | ocda.test.js |
| RT-08 | Strict malformed OCDA Object -> URU | 400 + EHU | ocda.test.js |
| RT-09 | VTE.A -> VTE.B | 200 / isolated | ocda.test.js |
| RT-10 | Independent document operations -> scheduler | overlap | scheduler.test.js |
| RT-11 | Same document operations -> scheduler | FIFO | scheduler.test.js |
| RT-12 | Resource failed -> scheduler | EHU and lock release | scheduler.test.js |
| RT-13 | File UTF-8 BOM/CRLF round-trip | unchanged bytes | documents.test.js |
| RT-14 | Browser picker -> Hub / permission | user gesture | Browser E2E pending |
| RT-15 | Active tab -> text area -> save -> close | no loss | Browser E2E pending |
| RT-16 | Nested A -> B -> A deadlock | fail fast | Not implemented |

Code presence is not a PASS verdict. GitHub CI and actual browser
execution must be checked separately before the PR can be accepted.
