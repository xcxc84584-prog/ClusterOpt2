# PR06 Relation Test — Patch1

Node: plugin-pr06-security.test.js. Reject unknown permission, Core claim escalation, cross-owner grant, missing approval; revoke and Provider removal clear authorization. Reject data getters, functions, cycles, ArrayBuffer, prototypes, >64KiB. Existing PR04/PR05 routes, Chromium and release version tests remain mandatory. No manual browser File System Access acceptance claimed.

## Patch2 Automated Tests
Node mock transport verifies owner checking, builtin allowlist, message shape, timeout termination, malformed/replayed response fails closed. Real Chromium browser E2E exercises bundled Worker echo/lineCount and source denial. Existing PR04/05 integration and all five CI workflows still required.

## Patch3 Relation Test
Node: plugin-pr06-adversarial.test.js checks digest mismatch, mutable input, oversized/revoked source, malformed Worker return and no leakage. Chromium: plugin-pr06-security.spec.js validates WebCrypto SHA-256 and denies remote plugins. Existing 5 CI workflows still required before acceptance; no manual 5GiB/third-party sandbox claims.

## Patch4 — Four-page Plugin Manager
The user-approved sketch is implemented as four separate views: Plugin List, Plugin Permission, API List, EHU Log. Existing slice budget/highlighter/processor/committer control remains reachable through Plugin Tool. URU provides only live registration data; OMU provides EHU; permissions are read-only plus already-authorized revocation, never synthetic grants. PR06.08 approval ceremony remains separate and NOT complete. Responsive layout and Playwright real browser verification required.

## PR06.08 Consent Patch
A user-visible modal now allows explicit session-only grant decisions on each permission; denial creates no grant, revoke removes active grant. The modal rechecks URU Provider identity and exact Manifest reference before approval and requires a trusted click. This is only an application Host consent path: same-origin arbitrary plugin execution stays permanently blocked by PluginSourcePolicy; isolated-origin third-party sandbox remains a separate pending requirement.

## Release Candidate 0.0.12 Gate
This release intentionally enables only trusted, bundled Worker plugins. Untrusted third-party JavaScript is rejected by PluginSourcePolicy (never executed); distinct opaque-origin sandbox and independent publisher provenance are **not implemented** and must not be advertised as supported. Session-only consent UI confirms declared permissions and allows revoke, but is not a security boundary against already-compromised host origin. Each of the four Plugin Manager pages reads URU/OMU live data. Requires exact-head 5-workflow CI PASS and verified SHA branch before major merge. This is an explicit scope limitation, not a claim of full third-party plugin support.
