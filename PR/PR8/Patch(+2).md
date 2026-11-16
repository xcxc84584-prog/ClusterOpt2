# PR8 Patch(+2) — PR6/PR7 VTE relation verification

- Test actual OCDA Explorer / Workspace / FileTypeManager components
  against a detached VTE core, not a mock API-only object.
- Simulate import, reorder, type block, close root and invalid request.
- Confirm PASS/FAIL and EHU, Request and Response relation codes.
- No disk/file handle privileges requested; only simulated directory.
- PR8 slice editor remains pending; VTE is not browser filesystem QA.
