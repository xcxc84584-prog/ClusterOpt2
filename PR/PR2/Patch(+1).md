# PR2 Patch(+1) — Original UI and global RGB Property

## Before
PR1 reused original ClusterOpt styling but did not mount its RGB palette.
The global `UI_COLOR` property was reserved, not implemented.

## Changes
- Reuse original palette dialog and Tool menu structure.
- Add dedicated `UI_COLOR.js` Property for validation and color derivation.
- Add dedicated `InterfacePalette.js` black-box OCDA Object.
- Add `palette-ui.js` adapter to wire Hex/RGB/preset controls.
- Register `UI_COLOR` via LinkCore and publish version 0.0.2-pr2.patch1.
- Use HubUnit for UserAPI Requests, Property publication and OMU logs.
- Persist color in localStorage with guarded errors; apply on reload.
- Add unit and Chromium tests including authorization and persistence.

## Risk / Pending
Native browser and manual UI visual comparison should be reviewed.
No Worker thread needed for tiny palette updates.
