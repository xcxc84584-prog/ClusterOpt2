# PR2 — Global RGB Interface Palette

## Requirement
Preserve and reuse the original ClusterOpt palette menu/dialog.
Allow users to edit R/G/B (0–255), pick a hexadecimal color, and
switch between black/white endpoint presets. Every UI Object must use
one shared UI_COLOR Property, not independently store colors.

## Acceptance
- PR2-01: Original ClusterOpt menu → Tool → Interface Palette UI opens.
- PR2-02: Hex picker and three numeric fields update the same RGB Property.
- PR2-03: CSS color tokens change immediately across UI elements.
- PR2-04: Color contrast chooses dark/light mode automatically.
- PR2-05: Choice persists over reload; invalid saved values revert safely.
- PR2-06: All Property updates are mediated by HubUnit and observed by OMU.
- PR2-07: Object uses UserAPI and read-only AgentAPI with 403 for violation.
- PR2-08: Each Object/Property resides in a distinct source file.
- PR2-09: Tests include pass/fail, persistence, permission and browser UI.

## Out of scope
PR3 language switching, PR4 storage priority, PR5/6 Explorer,
PR7 giant-file virtualization, PR8 GoToLine and PR9 PowerShell.
