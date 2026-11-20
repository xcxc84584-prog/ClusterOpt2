# PR24 Patch(+4) — Session-to-Hub reverse RPC adapter

Status: Draft, partial integration; main unchanged.

## New implementation
- PluginHostRequestGateway: host-owned entry for authenticated
  Plugin -> Host requests, with real PluginSessionUnit identity.
- URU Provider/Object existence and disabled state checked per request.
- Runtime permissions are refreshed through LinkCore checkPluginPermission.
- Requests flow exclusively into HubUnit.request; no Object direct calls.
- Response envelope includes request ID, event ID and status.
- OMU records RPC request, response, and EHU on failures.
- Dedicated relation tests for replay, spoofed source, disabled Provider,
  revoked grant, foreign port and Hub failure.

## Important limitations
- Gateway is not yet attached to the legacy Worker bootstrap or
  PluginHostInstallUnit activation path; third-party reverse requests
  are not yet working end to end.
- Existing Host -> Plugin invokes continue using legacy transport.
- Current gateway fails closed without a live Provider and grants.
- Response event correlation is an initial implementation: full
  parent-child causality and consistent event allocation need VTE.
- The new gateway uses UserAPI restrictions in HubUnit.request, but
  fine-grained per-action capability grants are a later task.
- This is not evidence of PR24.31–40 E2E completion.

## Verification
Node relation test is submitted to the standard npm test glob.
Review GitHub CI against the exact final SHA before claiming PASS.
