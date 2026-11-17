# PLUGIN PR04 — Relation Test

## PR04.01 automated assertions
- Existing target-ID request unchanged and still returns 200.
- One Provider is selected by canonical Service/action.
- Malformed selector/options => 400, missing => 404, ambiguous => 409.
- Disabled Provider is excluded; enabling it restores ambiguity.
- UserAPI, AgentAPI and AccessPolicy still enforce original 403.
- EHU records resolution failures and authorized Request/Response.
- VTE isolated; request graph has forward=10 and reverse=01.
- No implicit materialization or persistent Provider index.
- Browser Chromium integration leaves original Cluster.api unchanged.

## Gate
Pending exact latest-head CI success. Code submission is NOT proof.
No real 5GiB editor or physical file-permission acceptance is claimed.
