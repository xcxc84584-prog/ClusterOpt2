# PR14.10 ArcD

## Objects and dependencies
Node/VTE tests, Playwright Chromium scenarios, gateway Node syntax checks, four GitHub Actions workflows

## EventChain
Grant -> WS pairing -> routed tool action -> reply -> EHU/Log -> deny/revoke -> reload -> recheck with real Windows Agent and HTTPS OAuth.

## Relation
Default 00. Only host-authorized source Object and user-approved
capabilities may initiate requests through HubUnit. Replies remain
bounded. OMU records all denials as EHU and successful events as Log.

## Error handling
400 invalid input; 403 denied capability; 404 missing target;
409 conflicting action; 413 size limit; 503 missing service;
504 timeout. No secret, full path or file contents in EHU.
