# PR3 Plan — Patch(+1)

## Knowledge and source reuse
- Original ClusterOpt `Program/src/language.js` stores a zh-Hant/en
  catalog with guarded localStorage and DOM update subscriptions.
- Original `Program/index.html` has #languageBtn and #languageOptions.
- PR3 reuses these visuals and behavior, but routes all shared state
  changes through HubUnit and EDPMU instead of a private UI singleton.

## Sequence
PRD → Plan → ArcD → Implementation + Relation Test → Project.

1. Inspect global property registry and reuse existing LinkCore.
2. Create `Implementation/property/Language.js` with immutable
   locale catalog, validation and deterministic interpolation.
3. Create `Implementation/object/LanguageManager.js` with full OCDA
   contract, UserAPI, restricted AgentAPI and persistent storage.
4. Register initial Language once via HubUnit in LinkCore.
5. Reintroduce original language submenu and UI adapter.
6. Translate PR1 FileWorkspace confirmations / document status and
   PR2 palette. Keep document bytes untouched while toggling.
7. Test PASS and FAIL Event Chains using Node and Chromium.
8. Update each PR3 document and handoff before proposing merge.

## Data flow / parallelization
- Each Language.set targets one LanguageManager resource key: FIFO
  serialization is required to avoid race conditions and reorder.
- Other independent FileDocument and InterfacePalette operations remain
  eligible for scheduler overlap; no Worker needed for string lookup.
- Translation lookup is O(1), DOM application O(number of UI nodes),
  stored value under 10 bytes, no HTTP network traffic.
- Runtime property registry clears on refresh, persistent preference is
  restored by the Object at startup and republished to EDPMU.

## Security / correctness
- Never evaluate translation strings or write arbitrary HTML.
- Use textContent / setAttribute, safe placeholder interpolation.
- Enforce locale allowlist; do not expose AgentAPI.set.
- localStorage errors produce EHU and retain the editor in memory mode.
- No hardcoded passwords/keys, no machine absolute paths.
- Preserve PR1 editor unsaved data and PR2 RGB values across toggles.

## Pending acceptance
Automated tests must complete successfully at the *latest* PR head.
Native browser visual and accessibility acceptance remains separate.

## Patch(+2)
Accessibility labels are part of the shared locale projection: File menu,
Tools group and Palette dialog close are translated with Language,
not hard-coded per Object. Validate them in Chromium in addition to
visible text. Runtime cost O(3) extra attribute assignments per change.
