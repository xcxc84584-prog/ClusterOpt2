# Patch(+6) — CI stabilization and API isolation

## Fixed
- Fix an EDPMU Set traversal bug found by actual GitHub CI.
- Correct UTF-8 BOM test fixture decoding.
- Stop code-quality lint from treating localhost HTTP URLs as disk paths.
- Use Ubuntu 24.04 for the pinned Playwright 1.56.0 browser version.
- Resolve Playwright's webServer command relative to its config directory.
- Route tab activation/close requests through HubUnit.
- Enforce UserAPI/AgentAPI action allowlists on explicitly tagged calls.
- Mark UI-sourced editing as origin="user" rather than impersonating
  FileWorkspace in the HubUnit dependency graph.

## Verification
- Node unit, code-style, EHU/Log, authorization and concurrency tests
  have been rerun via GitHub Actions on recent commits.
- Browser test execution must still be verified on the final commit;
  native file dialog permissions require user acceptance in Chrome.
- PR1 must remain Draft until latest required checks succeed.
