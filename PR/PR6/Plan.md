# PR6 Plan — Patch(+1)
Status: FOUNDATION / NOT PASS
Baseline: main 8a2ee524676861f6dab6aa3e86cb02eb7cdb5708
Branch: pr6/explorer-foundation-patch1

## Requirements and examples
- New and opened documents appear in Explorer using workspace metadata.
- Search "HELLO" matches "Hello.cpp" without affecting open tabs.
- Selecting a row activates the original document ID.
- Explorer New/Open reuse the existing authorized browser file pickers.
- Existing PR1–PR5 editors, tabs, language and theme are retained.

## Knowledge and security
Reference the existing ClusterOpt UI and VS Code Explorer interaction.
Native file picker requires secure context and explicit user gesture.
Never persist a handle in localStorage; permissions must be rechecked.
No secrets, machine paths, arbitrary HTML from filenames, or duplicate
document buffers. Render names using textContent only.

## Performance and traffic
Filtering O(N * L), N visible workspace documents, L name length;
metadata projection O(N), no network traffic or full-file re-reads.
HubUnit continues independent resource scheduling; workspace is the
single serialized owner of tab changes.

## Next patches
1. IndexedDB recovery, explicit schema, graceful permission errors.
2. Directory import and hierarchy with lifecycle cleanup.
3. Restore tab order, scroll viewport and search/tree state.
4. Cross-browser tests, failure injection, UI color/i18n and CI.

## CI extension
PR6 feature branches now trigger the OCDA CI workflow on push.
Patch(+2) adds browser smoke checks for the Explorer sidebar.

## Patch(+3) — faithful original Explorer shell
- DOM IDs, top-left Explorer toggle, close, import controls and tree
  copied directly from original ClusterOpt Program/index.html.
- Explorer CSS geometry/typography adapted from Program/src/style.css.
- OCDA Explorer/Workspace interaction preserved; no legacy global state.
- Directory picker action is available; full tree import and recovery
  remain pending. No PR6 PASS claim.

## Patch(+4) folder tree baseline
- Original Explorer visual shell is preserved.
- Directory import reads first level lazily, nested folders on expansion.
- Refresh collapses folders without discarding open tabs.
- Filesystem handles live only in runtime memory for this patch.
- O(number of children) per directory expansion, no network traffic.
- Native handle permissions, directory traversal errors -> Hub EHU.
- Still pending: IndexedDB restore, file click/open, external CRUD sync.

## Patch(+5): one Explorer workspace
Unify imported roots and opened tabs in one tree, no separate headings.
Match FileSystemHandles via isSameEntry to avoid duplicate entries.
Folder files open through Explorer -> Hub -> FileWorkspace.open.
Unattached tabs become top-level entries. Identity matching is O(D*F)
for visible folder files and open documents; no remote network traffic.

## Patch(+6): IndexedDB recovery
One bounded versioned session includes editor content, tabs, handles,
active document and scrollTop, plus imported Explorer root handles.
Save is debounced at 350ms after user operations; writes serialized.
Invalid schemas and IndexedDB failures produce EHU without erasing
previous good snapshots. Each text <=8 MiB, <=100 docs, <=40 roots.
Browser file permissions cannot be granted silently on reload.

## Patch(+7): root expansion and visible tree persistence
Expanded paths stored per root (max 500); restored by lazy enumeration,
maximum recursion depth 24. Explorer visible/query/scrollTop saved to
sessionStorage. Expanded directory polling every 2.5s while visible.

## Patch(+8): browser acceptance
Playwright real Chromium reload checks editor scrollTop and IndexedDB
recovery, without confusing the caret offset with the viewport.

## Patch(+9): recovery fallback
Observed Chromium CI returned no persisted IndexedDB snapshot immediately
after navigation. Add a bounded sessionStorage text-only fallback without
FileSystemHandles. IndexedDB remains authoritative for handles and roots.
Log fallback failure without erasing existing snapshots.

## Patch(+10) reload stability
Playwright waits for the IndexedDB transaction and sessionStorage
post-commit marker before triggering navigation. This validates a
completed write rather than an in-flight read.

## Patch(+11) legacy Explorer interaction correction
Original ClusterOpt Explorer v0.0.19 selected-row and search styling
is reused. Only a single row receives .active; no folder/root
automatically inherits active text editor status. Right-click
shows row-local primary/secondary toolbar. Unsupported destructive
operations remain disabled until an OCDA transactional design exists.

## Patch(+12) accepted UI regression
PR7 browser test now checks original row-local action toolbar instead of
obsolete floating context popup. Child directories without a supported
close lifecycle expose a disabled close action, preventing fake success.
