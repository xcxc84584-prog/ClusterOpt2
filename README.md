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
