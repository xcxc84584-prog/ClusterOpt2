# PR21.1 Patch(+2) — Native Agent validation and responsive layout hardening

- Reapplied PowerShell `ExpectedVersion` ValidatePattern directly from the original script, changing only the optional single-letter suffix. This fixes the 0.0.15a rejection without duplicating installer functions. Native Local Agent version is matched against the `0.0.15b` manifest.
- Updated PR19 CMD filename regression assertion from 0.0.15a to 0.0.15b.
- The iframe toolbar reports measured height via a ResizeObserver event; the trusted host positions the ToolBox dropdown beneath the actual wrapped header, validates message source and bounds, and limits width/height to the panel. File System Access handles and PS privileges stay host-owned.
- Added a Playwright 420px viewport test to assert the dropdown never overlaps the toolbar or escapes the panel.
- Retained full ZIP and CMD downloads in the pre-pairing guide; EHU failure paths remain host-owned.
- This patch changes no core HubUnit/OMU/EDPMU/URU algorithms.
