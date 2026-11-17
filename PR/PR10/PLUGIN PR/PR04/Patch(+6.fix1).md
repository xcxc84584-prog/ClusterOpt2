# PR04 Patch(+6.fix1) — CI lint false positive

The mandatory credential-pattern lint flagged an example literal in
plugin-pr04-observe.test.js. Replace test-only fixture vocabulary with
non-credential wording. No production logic or security gate changed.
All five exact-head workflow results must be rechecked; this fix is
not accepted until the full gate passes. Same major Draft PR retained.
