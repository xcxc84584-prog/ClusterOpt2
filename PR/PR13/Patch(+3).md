# PR13 Patch(+3) — Whole-folder plugins and portable snapshots

## Changes
- PluginFolderPackagePolicy.js: bounded paths, file count, asset sizes,
  and existing Provider Manifest contract validation.
- PluginFolderPackageUnit.js: recursively snapshots selected folders,
  preserving nested HTML/CSS/JS and binary assets as base64.
- PluginLocalPackageUnit.js: prefers full-folder staging when supported.
- PluginPackageStoreUnit.js: IndexedDB inert snapshots, no auto-activation
  or permission restore.
- LinkCore.js: host-only API for snapshot/import/storage; publishes
  one read-only immutable policy through existing EDPMU.
- plugin-resource-view.js: user-initiated package bundle export/import
  and local folder storage.
- plugin-folder-package.test.js: multi-file, malicious path, oversize,
  binary, tamper and VTE registration tests.

## Critical caveats
This does not yet restore currently active third-party plugin runtimes
after reload. Only the validated package bytes can be recovered.
The ZIP format is not used: exported JSON is a portable binary-safe
bundle. Imports never execute arbitrary JS and never grant permissions.

## Not yet passed
PR13.3 sandbox, RPC transport, invocation-time authorization, browser
adversarial tests, and PR13.8 full reload activation safety gate.
Main remains untouched; PR #58 stays Draft.

- Optional uiEntry supports a complete plugin webpage folder with
  separate host-facing service entry and sandbox UI page; it is not
  executable in the host DOM.
- IndexedDB saves await transaction completion rather than request-only
  success.
