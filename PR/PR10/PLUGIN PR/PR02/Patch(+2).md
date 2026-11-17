# PLUGIN PR02 — Patch(+2) / PR02.02
## Need
Existing Object.ocda has arrays of Request and User/Agent API names but
no safe metadata descriptions. Cannot accept arbitrary descriptors that
advertise an action not callable by the corresponding Object.

## Implementation
- ObjectContract imports canonical APIDescriptorPolicy.
- Optional Object.ocda.APIDescriptors validated at URU registration.
- Reject mismatched owner, action, visibility or duplicate action.
- Export describeObjectAPIs as immutable internal projection.
- URU.describeAPI(id) returns validated metadata for a registered
  Object, never auto-instantiates unknown factories.
- Node real LinkCore and Playwright Chromium runtime tests.
- Update workflow, Plan/ArcD/Relation, PRD and handoff.

## Non-goals
No new Service Registry, unauthorized route editing, global API
Catalog read-only UI, untrusted plugin runtime or File System Access.
Failure 400 is observed through existing Hub/OMU registration EHU.

## Gate
All exact-head Node/Chromium/Windows checks PASS before this small
PR is accepted and checkpointed. No merge of PR02 while 02.03–02.10 TODO.
