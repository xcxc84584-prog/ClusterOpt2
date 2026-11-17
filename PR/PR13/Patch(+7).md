# PR13 Patch(+7) — Provider lifecycle and dependency safety

## PRD / Scope (PR13.6)
- Enable and disable host-installed user Providers through the existing
  HubUnit/URU authority. Preserve sandbox handles in PluginHostInstallUnit.
- Detect dependent active Providers by URU's live manifests and live
  alternative service candidates. Reject unsafe disable/uninstall with 409.
- Add explicit-consent upgrade for the same Provider and Object identity.
  Do not automatically escalate capabilities.
- Roll back the previous Object, Provider, currently active grants,
  enabled state and sandbox when replacement activation fails.
- Keep the entire PR13 in Draft; no release version change.

## Implementation
- `Implementation/LinkCore/PluginHostInstallUnit.js`: live dependents(),
  guarded disable(), enable(), uninstall(), upgrade() and OMU audit.
- `Implementation/main/plugin-manager-ui.js`: managed Provider toggles
  use host lifecycle; display dependency conflict on removal.
- `Implementation/tests/plugin-sandbox-install.test.js`: VTE cases for
  required-provider protection, consent, immutable identity and rollback.

## Event chains
1. Disable -> URU live Provider -> find active dependents -> 409 EHU or
   HubUnit.setProviderEnabled -> URU disabled state -> OMU Log.
2. Uninstall -> dependency gate -> HubUnit.unregisterProvider ->
   HubUnit.unregister Object -> terminate sandbox -> OMU Log.
3. Enable -> current dependency service resolution -> HubUnit enable.
4. Upgrade -> revalidate snapshot -> explicit capability review ->
   assert same identity -> dependency/inflight checks -> disable old ->
   unregister old -> install next via Hub/URU -> terminate old on
   success; on failure re-register prior Object/Provider, replay only
   previously effective grants, restore state and keep previous sandbox.

## Relation / EHU matrix
| Scenario | Expected | Audited behavior |
| --- | --- | --- |
| Required Provider disabled/uninstalled | 409 | EHU DependentProviders |
| Missing dependency when enabling | 409 | EHU Dependency |
| Upgrade without explicit consent | 403 | EHU UpgradeConsentRequired |
| Upgrade identity mismatch | 409 | EHU UpgradeIdentity |
| Upgrade while provider in flight | 409 | EHU UpgradeBusy |
| Upgrade replacement activation fails | 409/502 | Rollback EHU |
| Valid uninstall | 200 | Log Uninstalled |

## Important limitations / gates
- The dependency graph is a computed read of URU, NOT a second registry.
- The Plugin Manager has a native-folder update picker, package validation
  and explicit permission consent. Browser UX acceptance is still pending.
- Replacement activation is not zero-downtime: requests arriving during
  the re-registration window can temporarily fail.
- Rollback after a *failed restoration itself* is fail-closed, not a
  guarantee of always-successful restoration. Capture EHU 500.
- Existing sandbox only executes self-contained modules; full HTML UI,
  arbitrary relative imports, synchronous infinite-loop isolation,
  cross-browser CSP and browser adversarial checks remain pending.
- Node/VTE tests and GitHub CI results MUST be observed before PASS.
- Never claim PR13.7/13.8 are complete based on this patch.

## Recovery
Original rollback point: `backup/pr13-prestart-20261117`.
Patch branch: `pr13/dynamic-plugin-manifest`, PR #58 (Draft).
Do not merge main or update ReleaseVersion until the major PR passes.
