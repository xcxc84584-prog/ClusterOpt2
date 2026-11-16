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
