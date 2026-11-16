# PR8 Patch(+5) — Plugin Performance entry
- Replaced disabled Text Highlighter menu item with Plugin submenu.
- Added Performance > Maximum Text Loaded (MiB) or Off control.
- Settings pass through HubUnit to SliceRegistry and persist.
- Highlighter submenu is present but disabled until CSS plugin ready.
- Browser and Node storage tests added, PR4 legacy test updated.
- Editor still uses old full-buffer model; registry budget is real but
  not yet wired to the editor slice loading operation.
Status: PR8 PARTIAL; CI pending.
