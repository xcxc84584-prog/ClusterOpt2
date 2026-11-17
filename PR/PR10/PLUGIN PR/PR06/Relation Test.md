# PR06 Relation Test — Patch1

Node: plugin-pr06-security.test.js. Reject unknown permission, Core claim escalation, cross-owner grant, missing approval; revoke and Provider removal clear authorization. Reject data getters, functions, cycles, ArrayBuffer, prototypes, >64KiB. Existing PR04/PR05 routes, Chromium and release version tests remain mandatory. No manual browser File System Access acceptance claimed.

## Patch2 Automated Tests
Node mock transport verifies owner checking, builtin allowlist, message shape, timeout termination, malformed/replayed response fails closed. Real Chromium browser E2E exercises bundled Worker echo/lineCount and source denial. Existing PR04/05 integration and all five CI workflows still required.

## Patch3 Relation Test
Node: plugin-pr06-adversarial.test.js checks digest mismatch, mutable input, oversized/revoked source, malformed Worker return and no leakage. Chromium: plugin-pr06-security.spec.js validates WebCrypto SHA-256 and denies remote plugins. Existing 5 CI workflows still required before acceptance; no manual 5GiB/third-party sandbox claims.
