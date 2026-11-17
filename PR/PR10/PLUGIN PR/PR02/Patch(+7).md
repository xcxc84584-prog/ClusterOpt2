# PLUGIN PR02 Patch(+7) — Version/Deprecation Compatibility
Major PR 2 / Small PR 7; branch plugin/pr02-api-catalog.

New single Property: CatalogVersionPolicy.js.
Stable same-major version >= requirement; pre-1.0 requires same minor;
optional since cannot exceed the declared version; deprecated is
informational. Strict numeric components must be safe integers.

ObjectContract validates since/version consistency at registration
(EHU 400 for contradictory descriptor), without altering request
permissions. LinkCore registers the policy once via HubUnit. Node +
Chromium tests and dedicated CI updated. No public facade or plugin
execution API, no file operation and no production version bump.

Previous PR02.06 CI failure identified from run 44025082253: strict
metadata collection rejected valid legacy Objects without descriptor.
Fixed CatalogCollection to skip legacy metadata, not unregister
Objects or invent descriptions. Added regression test. Await new CI.

PR02.06 and PR02.07 exact-head checks remain PENDING, no verified
recovery checkpoint for either yet; PR02 main Draft.
