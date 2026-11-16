# PR2 Relation Tests

| ID | Source → Target | Expected | Test |
| --- | --- | --- | --- |
| 01 | UI → HubUnit → InterfacePalette.get | 200 PASS | palette.test.js |
| 02 | UI → HubUnit → InterfacePalette.set | 200 PASS | palette.test.js |
| 03 | UI → InterfacePalette.set invalid | 400 EHU | palette.test.js |
| 04 | Agent → InterfacePalette.set | 403 EHU | palette.test.js |
| 05 | InterfacePalette → Hub → EDPMU(UI_COLOR) | Published | palette.test.js |
| 06 | Reload → storage → UI_COLOR | Recovered | palette.test.js / e2e |
| 07 | Tool menu → RGB dialog | Opens | editor.spec.js |
| 08 | Color picker / RGB channels → CSS tokens | Live change | editor.spec.js |
| 09 | Presets 0 / 255 → light/dark | PASS | editor.spec.js |
