# PLUGIN PR06 ArcD

Manifest.permissions → PluginPermissionPolicy (declaration validation only) → HubUnit host authorization → PluginPermissionUnit (volatile grant records) → future PR06 Worker Runtime mediated actions. URU remains provider identity authority, OMU EHU/Log remains event authority. Message payloads pass PluginMessagePolicy before future Worker posts; no direct shared privileged references.

Event chains: register → inspect capabilities → authorize host grant / deny & EHU → check → revoke → forget on unregister. Message → data-tree validation → bounded clone → freeze / 400/413. No additional Route Table author, no filesystem access.

## Patch2 Event Chain
Host LinkCore → HubUnit verified owner + execution.isolation='worker' → PluginSourcePolicy(builtin only) → TrustedPluginWorkerUnit → PluginMessagePolicy (request) → fixed TrustedPluginWorker.js → PluginMessagePolicy(response) → terminate → OMU Log/EHU.

No arbitrary source URL or remote code enters this chain. Timeouts terminate Worker instances; cancellation cannot prevent all external side-effects, which is why untrusted source execution remains disabled.

## Patch3 Integrity gate
Trusted expected SHA-256 + detached file bytes → PluginArtifactPolicy.verify → 200 hash metadata or 400/412/503. No Provider activation, worker import, network access, or side effects. Worker failure → TrustedPluginWorkerUnit → OMU.EHU (status/operation only), terminate and release active quota.
