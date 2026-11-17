# PR06 Patch1 — PR06.01, PR06.02, PR06.05

- PluginPermissionPolicy: controlled standard/privileged/core capability declaration, no automatic power from Manifest.
- PluginPermissionUnit: host-only owner checked grant/revoke and runtime ledger with OMU EHU/Log; Core always denied, privileged needs approved=true.
- PluginMessagePolicy: bounded detached JSON data-only messages, rejects handles/functions/accessors/prototype pollution/oversize/cycles.
- LinkCore/HubUnit routes permissions through one existing core. No untrusted code execution added.
- Unit/VTE regression submitted, CI pending.
