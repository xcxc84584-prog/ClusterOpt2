# PR14.2 Relation Test

| Case | Expected result | Evidence |
| --- | --- | --- |
| Package manifest validation | 200, both policy gates | Node test added |
| Worker named exports | exactly getStatus/describe | Node test added |
| Missing human consent | 403, no URU registration, EHU | VTE test added |
| Approved install | 201 and URU provider | VTE test added |
| Hub getStatus Request/Response | 200, contract-only | VTE test added |
| Hub describe Request/Response | 200, declared capabilities | VTE test added |
| Invalid request payload | 400 EHU | VTE test added |
| Unknown action | 4xx EHU | VTE test added |
| Removal | 200, URU cleared | VTE test added |
| Unsafe path in Manifest | 400 | Node test added |
| Core capability is denied | 403 on review | Existing PluginCapabilityReviewPolicy, regression to add |
| Real sandbox Chromium | functional plugin load/response | NOT RUN |
| Real ChatGPT OAuth connection | PR14.8 | NOT RUN |

No claim of full PR14.1 legacy UI parity; that is the PR14.10 gate.
