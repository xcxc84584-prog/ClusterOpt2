# PR13 Patch(+12) — unified product and local-agent release mirrors

## Issue
The 0.0.15 release check found PR9 final-acceptance assertion
`agentManifest.version === ReleaseVersion.product` failing because
the local-agent distribution package remained at 0.0.14.

## Fix
- `Implementation/local-agent/package.json` mirror -> 0.0.15.
- `scripts/sync-release.mjs` verifies and writes both root package
  and local-agent package mirrors under canonical ReleaseVersion.
- The source of truth remains
  `Implementation/property/ReleaseVersion.js`, not a duplicate registry.
- Product/runtime API behavior is unchanged by this patch.

## Verification
Prior 0.0.15 candidate: OCDA npm check failed exactly one assertion
(364/365 passed), due to stale local-agent mirror.
Re-run all five workflows and browser tests at final SHA before merge.

## Release constraints
Bounded 0.0.15 milestone (see Patch+11), not full HTML UI or arbitrary
relative module loading. Preserve pre-merge backup and distinguish
unfinished PR13.7/13.8 capability delivery.
