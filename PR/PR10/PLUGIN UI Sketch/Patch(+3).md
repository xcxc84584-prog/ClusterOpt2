# Plugin Manager Patch +3 — Resources & Contract Explorer

- Remove dropdown from sidebar; support free-text Enabled/Disabled, owner, action and name searches.
- Sidebar toggle collapses to 39px while retaining restore button.
- Add read-only detailed API contract view (identity, visibility, version, schemas, Property access/invariants and raw JSON).
- Rename Performance to Resources. Left independently scrolling pane hosts maximum text load control and API/EHU JSON download tools; right independently scrolling pane lists registered Provider services with manifest download and searchable package path availability.
- Package URL unavailable in existing Provider Manifest schema; do not fake package download links. Manifest export is explicitly labelled metadata.
- Preserve original OCDA permissions, contracts and unified release mechanism; add focused unit and browser regression tests.
