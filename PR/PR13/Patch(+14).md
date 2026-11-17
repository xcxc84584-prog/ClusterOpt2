# PR13 Patch(+14) — Plugin Resources and API List spacing

## PRD / Screenshot findings
User-provided photographs reveal compact resource controls touching,
download cards with insufficient vertical separation, and an API table
whose narrow first two columns break words into very short fragments.
Native browser autofill popups are not application controls and must
not be styled or suppressed with unsafe page scripts.

## Plan
Retain current four-view Plugin Manager and two independently scrolling
resource panes. Adjust spacing only; never change HubUnit, URU, provider
permissions, persisted assets, search behavior or downloadable ZIP data.
Use scoped CSS under #pluginWindow to prevent unrelated editor changes.

## ArcD / Layout Contract
- Resources: headings -> search -> native folder chooser -> searchable
  catalogue cards, with visible gaps, divider, flex wrapping and
  minimum hit target heights.
- API: search row -> separate horizontal/vertical scrollable table,
  with minimum 900px table width, explicit first/second column widths,
  balanced schema columns and normal word breaking.
- Narrow windows preserve horizontally scrollable API data, instead
  of squeezing the Kind field into two-line fragments.
- No new Object, Property, EventChain, EHU code or registry.

## Implementation and Relation Test
- Styles: Implementation/main/style.css; scoped to Plugin Manager.
- Two Chromium UI assertions in pr13-plugin-layout.spec.js check
  search/chooser/cards spacing and API table first column/readability.
- Existing tests still check scroll state retention, search filtering,
  language-specific ZIP downloads and permission-gated mounting.
- Version is unchanged at 0.0.15. Merge only after checks pass.

## Restoration
Create a backup branch from the final accepted patch SHA before merge.
