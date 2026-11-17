# PR14.5 Patch(+5) — Real task submission event and test assertion

## Root cause analysis
A Chromium test showed the local Agent remained connected, the
ModelTaskObject was idle, and neither a user prompt nor queued status
appeared in the iframe. That means the model task was never submitted;
the prior cancellation state patches did not cause this.

The earlier test used a diagnostic JSON string containing the property
name `task` and erroneously interpreted that substring as a sent
WebSocket `task` message. This was a false positive test assertion.

## Fix
- Bind explicit task submission to the Send button click in addition
  to the semantic form submit event; a shared idempotency gate prevents
  duplicate sends if both occur.
- Dispatch the host-mediated `cluster-model-submit` intent before
  optional output rendering, so a rendering failure cannot stop the
  actual action.
- Replace the misleading JSON substring assertion with a precise
  check of actual `window.__modelSent[].type` values.

## Constraints
Still no secret or shell/file access in the iframe; task text goes
through the existing bounded HubUnit/ModelTaskObject validator.
The host owns authorization, UUID, EHU and cancellation.
Check final-sha Chromium/Node CI. Do not merge main on failure.
