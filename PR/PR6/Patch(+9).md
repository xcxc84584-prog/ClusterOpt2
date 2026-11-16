# PR6 Patch(+9) — Recovery fallback
- Added text-only sessionStorage fallback after IndexedDB persist.
- Never store FileSystemHandles in sessionStorage.
- On reload, use IndexedDB first and text fallback when missing.
- Preserve EHU logs on storage errors.
- Browser regression needed; PR6 NOT PASS until verified.
