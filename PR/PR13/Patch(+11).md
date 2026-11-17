# PR13 Patch(+11) — staged 0.0.15 release gate

## Change of release scope
By explicit user instruction, merge the *verified current PR13 milestone*
after full CI, with remaining unimplemented items clearly declared.
Do NOT claim all PR13.7/13.8 feature requirements are complete.

### Shipped capabilities
- Dynamic data-only Manifest and Provider Contract validation.
- Local full-folder snapshot/import/export, bounded inert asset storage.
- User-consented single-entry self-contained ES Module execution in a
  sandboxed opaque-origin iframe's dedicated classic Worker.
- HubUnit-authorized Request/Response/Property, URU sole registration,
  EDPMU shared Properties, OMU EHU/Log.
- Plugin install/update/disable/enable/uninstall, dependency protection
  and best-effort rollback, user permission review, persistent snapshots.
- API List table and bilingual author template.
- 106 browser tests + Node/VTE/OCDA validations on previous 0.0.14
  baseline, including 4 sandbox adversarial tests and OPFS race fix.

### Version
- Single authority `Implementation/property/ReleaseVersion.js`
  changed 0.0.14 -> 0.0.15; nextRelease now 0.0.16.
- `package.json` mirror changed to 0.0.15.
- All latest release-tag/version tests must PASS before merge.

### Explicit nonfeatures (do not imply support)
- Arbitrary relative multi-file JS module imports are not executable.
- Full HTML/CSS/JS plugin UI remains persisted inert data, not a running
  plugin interface.
- User-authored plugin code does not auto-execute after reload; no
  durable permission grant is silently replayed.
- Cross-browser and advanced navigation/exfiltration tests remain
  future work; Chromium gate covers current supported scope.
- Zero-downtime upgrade is not guaranteed. Current cutover blocks
  dependent Providers but may temporarily deny concurrent calls.

### Acceptance and rollback
- Confirm all five GitHub workflows PASS at final 0.0.15 SHA.
- Verify backup of main pre-merge SHA plus release-candidate branch.
- Merge PR #58 only as explicitly bounded 0.0.15 milestone; track
  unshipped capabilities as follow-up implementation.
- Do not state that complete PR13 goal is finished.
