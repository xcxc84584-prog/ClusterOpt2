# ClusterOpt2

OCDA-based local-first editor, rebuilt from ClusterOpt's existing visual UI.

## PR1 status
PR1 is under review. The code branch is
`pr1/ocda-foundation-patch2`; do not assume all browser permissions and
legacy UI appearance have been manually verified.

## Start
Open `index.html` over HTTPS (GitHub Pages) or localhost.
File System Access requires a supported Chromium browser and a user gesture.

For a local server:
```shell
node Implementation/e2e/server.mjs
```
Then visit `http://127.0.0.1:4173/`.

## Editor
File > New / Open / Save / Save As / Close.
Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S are supported.
Green = disk-synced, yellow = unsaved, red = error,
blue = current loading/saving operation with percent progress.

PR1 accepts UTF-8 files up to 64 MiB; PR7 handles larger documents later.
Unsupported encodings are rejected rather than silently rewritten.
Line ending CRLF and UTF-8 BOM are preserved.

## OCDA developer tools
```javascript
Cluster.log()
Cluster.objectlist()
Cluster.propertylist()
Cluster.rep()
Cluster.subobject("Parent")
Cluster.inheritedProperties("Parent.Child")
Cluster.version()
VTE.C("A")
VTE.C("B")
VTE.A("A", "B", "echo", { value: 1 })
VTE.log()
```

These runtime registrations and logs are reset when the page reloads.
VTE uses isolated in-memory test Objects, not real local files.

## Tests
```shell
npm run check
npm install
npx playwright install chromium
npm run test:e2e
```

PR1 documentation, event flow, relation tests and issues are under
`PR/PR1/`. No API keys or hard-coded machine paths are required.

## PR2 — RGB palette development
PR2 draft: https://github.com/xcxc84584-prog/ClusterOpt2/pull/2

File > Tool > Interface Palette uses the original ClusterOpt dialog.
Adjust RGB (0–255), hexadecimal color, or black/white presets.
All UI elements consume the shared `UI_COLOR` property via CSS tokens.
Settings are persisted locally when browser storage permits.

PR2 details and the versioned handoff are under `PR/PR2/` and
`總工作交接提示詞(v0.0.2-PR2).md`.

## PR3 — global language (in review)
Switch language with File > Tool > Language (繁體中文 / English).
The chosen locale is shared via LinkCore Language and restored across
reloads when local browser storage is available. PR3 documentation and
versioned handoff are in `PR/PR3/`.

## PR4 implementation under review
User-accepted PR1–PR3 remain the baseline. PR4 is not yet PASS.
`File > Tool > Close All` closes all tabs after one unsaved-data confirmation.
Tabs support native drag/drop ordering. Tool also exposes shared
`External First` / `Internal First` storage priority.
StoragePriority uses periodic and focus-triggered file metadata checks
(size + lastModified) and pre-save reconciliation.
Known limitation: identical size/mtime external edits are not detected.
PR4 work is reviewed in PR #5; the recovery branch is
`backup/pre-pr4-20261116`. Browser and CI validation remain pending.

Roadmap: PR5 edit-feel optimizations, PR6 Explorer, PR7 Explorer refinement,
PR8 sliced loading, PR9 go-to-line, PR10 PowerShell.

## PR5 editing feel (under review)
PR1–PR4 are user-accepted. PR5 introduces an immutable global
EditorInteractionPolicy shared through LinkCore. The original editor
adds bracket/quote pairing, selected-text wrapping, paired deletion,
Tab/space-group removal, Enter autoindent and viewport tab guides.
The duplicate File > Tool > Close All was removed; File > Close All
remains. CI/Chrome/Edge, IME, undo/redo and long-text performance
acceptance are still pending. Recovery: backup/pre-pr5-20261116.
