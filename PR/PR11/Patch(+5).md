# PR11 Patch(+5) — Browser acceptance and release gate
- Correct Playwright selector to exclude hidden application overlay when
  tests create a separate overlay fixture, avoiding ambiguous duplicate ID.
- Retain the full OCDA npm run check and browser E2E suite as merge gates.
- Stage unified product release 0.0.13 via ReleaseVersion.js and
  synchronized package.json. Do not bump individual sub-PR versions.
- Capture actual commit SHA and CI conclusions before merge.
- Main branch only changes after PR #56 passes merge gates.
