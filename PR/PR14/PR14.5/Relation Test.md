# PR14.5 — Relation Test

| Case | Expected | Execution |
| --- | --- | --- |
| Model/task policy validates payloads | 200/400 | VTE test added |
| Network-only grant cannot use model | 403 EHU | VTE test added |
| configure without grant | 403 EHU | VTE test added |
| Task without model.task | 403 EHU | VTE/Chromium added |
| Configure via host modal | Key never reaches iframe | Chromium added |
| provider_info updates model state | Correct metadata | VTE/Chromium added |
| Submit task through Hub | 200, UUID, short dispatch | VTE/Chromium added |
| Duplicate pending task | 409 EHU | VTE test added |
| Task_status/task_result matched | 200, UI output | VTE test added |
| Forged ingest UI source | 403 EHU | VTE test added |
| Cancel current task | task_cancel via Hub | VTE/Chromium added |
| Reset on disconnection | Active cleared | VTE case added |
| Key absent from OMU browser storage | No disclosure | Chromium added |
| Actual local Agent and model API | Text response | NOT RUN |
| Existing PR14 regressions | All PASS | Pending latest CI |

Do not equate added tests to executed PASS. The legacy Agent key store
does not currently have verified at-rest encryption.
