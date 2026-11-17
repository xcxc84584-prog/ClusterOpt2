# PR11 Patch(+1) — Highlighter reliability
- Migrated the PR10 test-plugin work into its own PR11 development branch.
- Reworked tokenizer into explicit language-aware comment / string scanner.
- Added source preservation, non-HTML token rendering and bounded requests.
- Fixed Resources preview filename selection and result envelope parsing.
- Improved provider conflict detection and registration rollback.
- Tied token preview colors to shared UI palette variables.
- Expanded unit tests for 10 filetypes, failure cases, idempotence.
- Pending: CI, VTE and browser E2E acceptance, editor overlay integration.
