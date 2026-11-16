# PR8 Patch(+1): Status and editor viewport foundation

Fix:
- Tab guides now use real newlines, actual font and editor geometry.
- Guides follow vertical and horizontal browsing rather than caret.
- Progress bar background follows DocumentStatus green/yellow/red/blue.
- Blue loading percentage represents only the active operation.

New Property: EditorViewportPolicy, globally registered by LinkCore.
Tests: node policy and VTE sandbox; Chromium viewport/status regression.
No P-tree/B+ tree or Plugin support is claimed in Patch(+1).
Status: PARTIAL, pending CI.
