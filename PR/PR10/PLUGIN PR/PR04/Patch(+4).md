# PLUGIN PR04.04 — Patch(+4)
- Added pure bounded RouteContractPolicy for schema-compatible data.
- Chain routes validate adjacent contracts at configuration and each
  input/output at execution, preserving authorization per hop.
- Chain stops on first failed hop and emits EHU for schema failures.
- No additional registration authority or hard-coded Provider names.
- Tests: plugin-pr04-chain-fanout.test.js (Chain assertions).
- Draft PR04 only; no unified version bump; exact-head CI required.
