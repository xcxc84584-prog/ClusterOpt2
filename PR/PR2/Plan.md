# PR2 Plan — Patch(+1)

## Reuse / Implementation
Use original ClusterOpt `Program/index.html` palette dialog markup
and its `Program/src/style.css` visual definitions already copied into
`Implementation/main/clusteropt-legacy.css` by PR1.
Do not redesign UI.

## Event chain
1. User opens File > Tool > Interface Palette.
2. UI issues `HubUnit.request(ui, InterfacePalette, get)`.
3. Selecting Hex/RGB/preset sends `Request.set` through HubUnit.
4. URU confirms sender/receiver, AccessPolicy checks UserAPI.
5. Scheduler serializes edits for the InterfacePalette Object.
6. InterfacePalette invokes global UI_COLOR algorithms.
7. HubUnit publishes updated UI_COLOR to EDPMU and OMU logs.
8. InterfacePalette applies CSS tokens and persists user preference.
9. Response returns canonical RGB/mode to the dialog.

## Knowledge
CSS custom properties, color-mix/relative luminance approximation,
browser storage and DOM dialog events.

## Security
Validate each RGB channel is an integer 0–255; reject malformed input
with EHU 400 and preserve prior color. No API key, no absolute paths.
External Agent may read palette, but may not modify it.

## Load / Traffic
Color changes: O(T + S), where T=14 CSS variables,
S=subscriber count. Fixed-size JSON ~13 bytes; localStorage write only.
Events remain inside the page; no network requests.
HubUnit handles rapid changes using per-object FIFO asynchronous queue.

## Patch(+1)
- Add UI_COLOR algorithms as a global Property.
- Add InterfacePalette as separate OCDA Object.
- Mount original palette modal using a thin UI adapter.
- Restore user settings and publish through LinkCore.
- Node and Chromium tests for all main interactions.

## Acceptance Gate
Do not mark PASS until node tests and Playwright tests run successfully.
Native light/dark visual review and accessibility follow as review items.

## Patch(+2) 更新
- 介面黑色端點精確沿用舊版 14 個 CSS tokens。
- UI 無效 RGB 會發 EHU 400，隨後以 Hub Request.get 恢復合法值。
- 由 PR1 延續的測試需配合全域 Property 預註冊更新測試假設。
