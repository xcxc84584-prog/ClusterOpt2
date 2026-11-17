# PR8 Patch(+25-Fix1) — Release version and favicon 404 hygiene

## Evidence
- User reports console HTTP 404 and Cluster.version() returning
  0.0.8-pr8.patch24.fix1 after Patch25 merge.
- Current index.html main assets and three plugin API download
  destinations exist in the repo at the inspected SHA.
- Existing site has no rel=icon and no favicon asset, which causes
  some browsers to request an absent /favicon.ico.
- Without the failed request URL from DevTools, the exact cause of
  the user's reported 404 remains unconfirmed.

## Changes
- LinkCore now centrally publishes 0.0.8-pr8.patch25.fix1 through
  SystemVersion and Cluster.version().
- Added repository-root favicon.svg using existing Cluster diamond,
  referenced with ./favicon.svg so GitHub Pages project paths work.
- No Explorer or editor UI redesign, no altered storage flows.
- Added Node release tests for version and all local HTML assets.

## OCDA Event chain
Cluster.version() -> LinkCore.getSnapshot() -> EDPMU.SystemVersion.
Neither a missing HTTP asset nor a browser favicon GET passes through
HubUnit; these requests do not necessarily generate OMU EHU.

## Security / load
- Static local SVG resource, no script, external dependency or key.
- Image is small and requested only as page branding.
- No new writable Object/API, no privileged access changes.
- HTML asset test covers declared local resources, not arbitrary
  runtime network requests or live GitHub Pages deployments.

## Verification and status
- Run OCDA CI and PR1 OCDA Verification before merge.
- Preserve backup/pre-pr8-patch25-fix1-main-20261117.
- Browser network panel remains the authority for a residual 404.
- PR8 overall is still under inspection, not PASS.
