# PR9 Patch(+5) — Legacy GoToLine UI and global line seek

## User request
- Recreate the original ClusterOpt line-jump UI without covering
  editor text or the bottom status bar.
- Jump to any valid global line even if the target is not in the
  currently loaded virtual page.
- Respect dirty MVCC pages, Unicode and CRLF, and bounded memory.
- PR8 uniform slicing and writeback are tracked in a separate stacked
  draft branch; do not silently reclassify them as PASS.

## UI
Old ClusterOpt Program/index.html #goLineBar / #goLineInput /
#goLineButton, and original Program/src/style.css flex-row geometry
were used as the reference. The bar is a dedicated flex child BETWEEN
the editor shell and footer, not a modal, absolute/fixed overlay or
new editor tab. Ctrl+G focuses the line input. Input is disabled while
a jump is active. User-visible errors use Language Property strings.

## Objects / Properties
- GlobalPageLinePolicy in its own property file, registered exactly
  once by LinkCore and global property catalog.
- FileWorkspace receives gotoLine via HubUnit, forwards to the
  existing VirtualFileDocument seekLine Request, returns to UI via
  Response. No direct Object internals are accessed by UI.
- VirtualFileDocument reads bounded source byte windows of at most
  1 MiB. UTF-8 LF bytes count lines; CRLF contributes one LF.
  Edited and pending recovery pages supply durable LF counts.
- Dirty page text is not lost or overwritten when leaving its page.
  The existing verified batch writer remains responsible for Save.
- Original LF counts are cached by source page, invalidated after
  successful Save or detected external generation change.

## Performance and security
Cold remote line search scans up to the target line (O(file bytes
scanned), <=1 MiB resident I/O buffer), yielding after eight pages.
Warm searches reuse cached source LF counts. No unrestricted whole
Blob text() or inline eval; no source file modification on navigation.
Save, editor bytes and permissions are not bypassed.

## Acceptance
- Node checks for LF/CRLF, UTF-8, dirty line shift, trailing LF,
  out-of-range and bounded byte scans.
- 65 MiB Playwright file: from source page0 jump to global line3
  in page2, then return to line1; no text mutation.
- Toolbar geometry is verified outside workspace and above footer.
- PR9 Patch4 and PR8 P0 outstanding issues remain separate.
- Do not merge without latest exact-HEAD CI and a backup branch.
