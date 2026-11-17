# PR14.3 ArcD — Generic plugin UI sandbox

## Object / Property
```text
                 Human consent
                      |
          PluginHostInstallUnit
             /             \
    HubUnit / URU        PluginUIHostUnit
             |                 |
    PluginSandboxBridge    host toolbar button
        isolated Worker           |
                             sandboxed iframe
                              AI Agent view
                          (UI-only, no privileges)
```

New LinkCore helper: PluginUIHostUnit (host-only lifecycle unit; does
not register Objects/Providers/Properties).
New declarative UI: uiEntry + JSON locale dictionaries.
No new shared EDPMU Property; global Language remains single authority.
Existing `AIAgentMCP` OCDA Object and worker Request/Response unchanged.

## EventChain / Relation
1. User installs package -> manifest/asset review -> explicit consent
   -> PluginHostInstallUnit -> Worker/Hub/URU identity -> UIHost.mount
   -> 201 Log; failed mount -> rollback + EHU.
2. User clicks host-created button -> show isolated panel -> iframe
   receives immutable locale data only.
3. LanguageManager changes Language -> document lang attribute ->
   UIHost sync -> iframe renders localized text (no permission change).
4. Disable -> Hub provider disabled -> UIHost hides button + panel.
5. Uninstall -> URU unregister -> UIHost.unmount -> Worker terminate.
6. Upgrade -> preserve previous validated view -> old unmount ->
   install new -> on failure restore previous Object/Provider/iframe.

All application Request/Response continue through HubUnit.
UI Host does not give plugin direct access to host objects.
Relation Code remains 00 for privileged adapters.

## EHU matrix
| Condition | Status | OMU |
| --- | --- | --- |
| No uiEntry | 200 (headless) | No UI |
| UI mounted after consent | 201 | Existing install Log |
| Malformed/missing UI asset | 400 | Install rollback EHU |
| Missing required DOM mount | 503 | Install rollback EHU |
| Permission denied | 403 | Existing install EHU |
| Disable/uninstall | 200 | Existing lifecycle Log |
| No permission but forged postMessage | No API side effect | Isolation test |

## Security
Sandbox iframe is opaque-origin with allow-scripts only. CSP excludes
network and external frames. UI cannot navigate the parent or access
its DOM. No token, key, workspace path or command enters the iframe.
Actual FileSystem/PowerShell/MCP capability routes remain deferred.
