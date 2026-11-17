# PLUGIN PR04 Patch(+10) — Major regression and unified release
- Run existing Node/VTE, Chromium, PR1, Catalog, Provider and Windows
  workflows at exact head; avoid redundant workflow definitions.
- ReleaseVersion.js becomes 0.0.10 stable, mirrored in package.json.
- Update version assertions to match canonical release source.
- Pre-major and final restore refs mandatory; only one PR merge.
- Physical 5GiB File System Access, untrusted Worker runtime,
  hard timeouts and routeVersion CAS remain out of this major scope.
- Pending exact-head CI until GitHub workflow results confirm PASS.
