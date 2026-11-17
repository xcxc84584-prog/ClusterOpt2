# PR11 Patch(+4) — Native Editor Syntax Overlay

## Implementation
- New Implementation/main/syntax-overlay-controller.js is UI-only.
- Display is an aria-hidden, pointer-events-none decorative overlay
  behind the real textarea. Selection, caret, keyboard and undo history
  remain managed exclusively by the native textarea.
- HubUnit requestService("ui", "editor.syntax.highlight", "highlight")
  is the only token acquisition path; no direct plugin receive invocation.
- Mounting the reviewed Provider enables overlay; no arbitrary code import.
- Visible/adjacent lines only (max 160 lines / 65,536 UTF-16 code units),
  1 MiB maximum scanned page and graceful unstyled fallback above budget.
- Scroll, switch-document, input and IME invalidate stale request generations;
  stale responses cannot overwrite the latest native editor content.
- Reused UI_COLOR tokens for theme matching. Browser resource asset query
  bumped for cache safety.
- Static OCDA source inventory now includes Implementation/plugins
  so it does not report the valid module import as a missing dependency.
- New Playwright smoke checks for safe token overlay and stale update.
- Still pending: GitHub CI green, user/real FileSystemAccess browser
  acceptance, exceptionally large viewport scenario measurement.

## Behavior and security
No script injection or innerHTML is used. Token content is textContent.
Source document, file handles, save queue and writeback are untouched.
The native textbox has a fallback state for any unavailable service.

## Known limitations
The overlay does not highlight pages larger than 1 MiB and may be disabled
for extraordinarily long visible lines beyond the 65,536-code-unit budget.
It is not a Worker: tokenization is bounded but currently synchronous.
