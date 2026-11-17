# PLUGIN PR06 — Security Runtime

## Scope
PR06.01 Trust/Threat Model, PR06.02 Manifest permissions, PR06.05 structured payload policy delivered in Patch1. PR06.03–04/06–10 still required before untrusted plugin runtime can be enabled. Existing host service routing remains intact.

## Non-negotiable boundary
A manifest claim is never a grant. Host-run grant records are volatile; privileged access requires explicit approval; core operations can never be delegated. No File Handle or DOM access to external providers. Same-origin Workers must not be treated as secure untrusted sandboxes.

## Patch2 Scope
PR06.03/04/06 candidate: approved, application-shipped trusted Worker operations only; messages are bounded and cloned; source policy rejects external/remote/blob/code URLs. Worker is same origin and cannot provide arbitrary third-party isolation. PR06.07–10 and cross-origin sandbox are pending.

## Patch3 Security acceptance candidate
PR06.07 content SHA-256 pre-pinned integrity check. Verification is not signature identity, not an installation approval and never authorizes arbitrary JS. PR06.09 sanitize Worker failure EHU without payload. PR06.10 injection, forged response, oversized artifact and Chromium negative tests. Untrusted isolated-origin plugin runtime / user consent still pending.

## Release Candidate 0.0.12 Gate
This release intentionally enables only trusted, bundled Worker plugins. Untrusted third-party JavaScript is rejected by PluginSourcePolicy (never executed); distinct opaque-origin sandbox and independent publisher provenance are **not implemented** and must not be advertised as supported. Session-only consent UI confirms declared permissions and allows revoke, but is not a security boundary against already-compromised host origin. Each of the four Plugin Manager pages reads URU/OMU live data. Requires exact-head 5-workflow CI PASS and verified SHA branch before major merge. This is an explicit scope limitation, not a claim of full third-party plugin support.
