# PR3 Patch(+1) — Language Property and bilingual UI

## Changes
- Added Language.js shared translation catalog and validation.
- Added LanguageManager.js OCDA black-box Object for get/set/translate.
- LinkCore publishes Language and PR3 version centrally.
- Restored original ClusterOpt language submenu (zh-Hant / en).
- Added language-ui.js view adapter; palette and editor share locale.
- Localized File menu, UI titles, Palette, statuses, file-close prompt,
  editor accessibility labels and fallback file-picker errors.
- Persisted user choice and guarded storage unavailability.
- Added language.test.js and Chromium menu/persistence/editor tests.

## Failure handling
- Invalid locale => HTTP-style 400, EHU, no state change.
- Agent changing locale => 403/EHU; Agent reads remain supported.
- Storage failure => EHU 400/503, safe memory/default state.
- Missing translation key falls back to key, never evaluates markup.

## Performance
UI repaint O(visible nodes), global language changes serialized
by LanguageManager key; unrelated Object I/O may remain concurrent.

## Acceptance
Final GitHub Actions Node and browser status pending verification.
