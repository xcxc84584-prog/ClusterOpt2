# PR06 Patch5 — Explicit Consent Dialog

The four-page Plugin Manager now supports deny, session-only approve, and revoke for registered Provider declared permissions. Trusted click event and fresh Provider identity reference required before approval. No grant persists; Core permission cannot be approved via PluginPermissionPolicy. Known limitation: this is not a security boundary against code already executing within the host origin, so untrusted JS remains rejected and cross-origin sandbox is pending.
