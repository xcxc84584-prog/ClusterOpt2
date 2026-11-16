# Patch(+5) — Legacy UI compatibility and browser acceptance

## Changes
- Restore original ClusterOpt DOM identifiers and legacy stylesheet.
- Remove custom PR1 color/typography/theme overrides.
- Keep a narrow CSS adapter for status indicators and editor wiring.
- Add Playwright Chromium tests for the actual file-menu/editor workflow.
- Provide a static localhost server using Node.js built-in APIs.
- Pin browser-test runner version and add a mandatory CI browser job.
- Fix OMU/EDPMU SubObject inherited property traversal (Set vs Array).
- Fix the UTF-8 BOM mock to inspect raw decoded bytes correctly.
- Preserve Source-Owner authorization and VTE isolation.

## Test scope
- Open and save an authorized text file using browser picker stubs.
- Switch tabs with unsaved content, close synced documents.
- Verify line-number gutter and four-state document status.
- Assert original ClusterOpt stylesheet is loaded.
- Unit tests cover authorization, Log/EHU, relation and concurrency.

## Remaining known limitations
- Native browser filesystem permission behavior is not reproduced by mocks.
- CPU Worker execution and cross-tab locks are not part of PR1.
- PR7 will replace whole-text memory processing for large files.
- Original legacy CSS includes styles for deferred PR2-PR9 features.
- Browser visual parity has not been approved by a human reviewer.

## Release status
Draft PR until the latest node and browser CI jobs both succeed.
