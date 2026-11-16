# PR3 — Global Language / Internationalization

## Requirements
Reuse the existing ClusterOpt File → Tool → Language menu.
Support Traditional Chinese (zh-Hant) and English (en), switching every
implemented PR1/PR2 visible control without reloading or losing editor
contents. All Objects consume one shared Language Property.

## Acceptance
- PR3-01 original ClusterOpt language submenu (two supported locales).
- PR3-02 File actions, Tool, Palette, Editor, statuses, confirmations
  and ARIA labels reflect the current locale.
- PR3-03 state shared through one EDPMU Language Property.
- PR3-04 LanguageManager OCDA Object implements get, set, translate.
- PR3-05 all cross-object changes via HubUnit, EHU/Log/Dependency recorded.
- PR3-06 unsupported locale rejected with status 400 and EHU.
- PR3-07 AgentAPI may inspect but not change language (403).
- PR3-08 preference persists on reload; invalid/unavailable storage
  falls back gracefully to zh-Hant or in-memory state.
- PR3-09 two-language translations extensible without new UI code.
- PR3-10 full Node relation tests and Chromium UI tests.
- PR3-11 PRD, Plan, ArcD, Patch(+x), RelationTest,
  and versioned handoff in PR/PR3.

## Exclusions
PR4 external-file storage priority; PR5/6 Explorer and reload recovery;
PR7 big-file virtual slices; PR8 GoToLine; PR9 PowerShell.
