# PR11 Patch(+2) — Current editor page preview
- The Resources left pane can copy the currently loaded editor page
  into its independent read-only source preview buffer.
- No modifications to FileWorkspace, textarea contents or on-disk file.
- Preview only receives at most 65,536 UTF-16 code units per request.
- Filename is copied for language detection and may be edited.
- Main -> Plugin Manager -> Resources uses injected read-only callback.
- Shared UI_COLOR token styles are preserved.
- Remaining: actual editor overlay, CI / browser / VTE acceptance.
