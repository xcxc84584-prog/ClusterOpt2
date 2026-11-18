# PR22.3 Patch(+2) — Chromium regression fixes

Latest Node/OCDA tests: 431 passed, 0 failed.
Windows PowerShell 5.1 / 7 and native-conpty tests passed.
Playwright full browser: 138 passed, 3 failed, corrected in Patch(+2).

1. ToolBox rejected Create checkbox intentionally resets to unchecked;
   use a click assertion instead of Playwright.check().
2. Existing shell consent browser test expected a modal containing
   the command; PR22.3 explicitly removes per-command consent.
   Assert zero dialogs and approved->revoked request results instead.
3. MCP read-only editor metadata is not a workspace-file operation;
   do not require an Explorer folder root to enable that capability.
   Workspace PS still requires root.

Rerun full browser CI after changes. Previous backup ref remains a
pre-fix rollback; create final backup ref only after successful CI.
