# PR25 Patch(+5): Registered UI Event / contract recovery

- EDPMU PluginLifecycleEventPolicy now documents the actual
  UICO.OwnedClick subscription, including {uiId} payload, ownership,
  click trigger, unsubscribe and independently routed completion.
- Static version gate verifies the Worker Session and UICO click
  implementation symbols, not merely the documentation version.
- UICO Action descriptors now include recovery guidance for 400, 403,
  404 and 409.
- Updated the global Property list, Plan and ArcD in accordance with
  OCDA. Event Policy is inert metadata, not a second event registry.
- Existing Browser, VTE, Unit and CI runs on final HEAD are the only
  accepted source of test outcome; do not reuse an earlier green SHA.
- Outstanding: exhaustive independent public API inventory and
  independent human third-party docs-only blind acceptance.
