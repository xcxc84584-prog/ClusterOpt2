# PLUGIN PR04 — Patch(+1)

## Delivered
ServiceRequestResolver.js as a dedicated LinkCore helper, with live
ServiceRegistry lookup and strict 400/404/409 outcomes.
HubUnit.requestService delegates one resolved Service/action to the
existing full Request/Response authorization and EHU path.
LinkCore.requestService exposes trusted internal call routing.
Added Node/VTE and Chromium regression tests plus PRD/Plan/ArcD and
latest mandatory handoff.

## Non-changes
Legacy request() remains unchanged; no UI route-edit surface, no
mutable Route Table, no untrusted Provider code, no release version bump.

## Risks
Ambiguous registrations intentionally return 409. Authorized selection
will be added in PR04.02–03 rather than relying on Provider order.
