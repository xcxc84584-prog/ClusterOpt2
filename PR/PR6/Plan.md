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
