# PLUGIN PR06 ArcD

Manifest.permissions → PluginPermissionPolicy (declaration validation only) → HubUnit host authorization → PluginPermissionUnit (volatile grant records) → future PR06 Worker Runtime mediated actions. URU remains provider identity authority, OMU EHU/Log remains event authority. Message payloads pass PluginMessagePolicy before future Worker posts; no direct shared privileged references.

Event chains: register → inspect capabilities → authorize host grant / deny & EHU → check → revoke → forget on unregister. Message → data-tree validation → bounded clone → freeze / 400/413. No additional Route Table author, no filesystem access.
