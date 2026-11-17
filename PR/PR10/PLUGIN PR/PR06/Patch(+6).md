# PR06 Patch6 — v0.0.12 Release Gate

- Product ReleaseVersion 0.0.12; root/native-agent package mirrors.
- Browser/API and PR05-version regression match 0.0.12.
- Four-page Plugin Manager with session-only consent; Core capabilities remain refused.
- No arbitrary third-party plugin execution; all external SourcePolicy requests fail closed. Isolated-origin future platform work required before enabling arbitrary plugins.
- Exact-head 5/5 CI and final restoration checkpoint required. No main merge before green CI.
