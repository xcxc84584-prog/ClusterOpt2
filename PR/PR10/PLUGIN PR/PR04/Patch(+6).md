# PR04 Patch(+6) — Masked Observe Sidecar

## Scope
- HubUnit: executeObserve after primary output contract succeeds.
- Observer input: immutable metadata-only envelope, no original content.
- Observer dispatch: existing request ACL and OMU; failure isolated.
- Route configuration rejects fewer than two Observe Providers.
- New targeted Node/VTE regression; existing CI workflows reused.

## Safety / exclusions
No Route ACL from browser, untrusted plugin Worker, hard abort guarantee,
routeVersion/CAS or product release. No edits to main.

## Verification
Local runtime unavailable to connector; acceptance requires exact-head
GitHub Actions Node/Chromium PASS and verified restore pointer.
