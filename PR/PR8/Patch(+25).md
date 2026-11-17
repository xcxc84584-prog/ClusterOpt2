# PR8 Patch(+25) — Legacy Explorer parity audit and safe transfers

## Purpose
Compare UI/functionality against the original ClusterOpt explorer,
while preserving all user-accepted PR1–PR7 visuals and behavior.
No separate redesigned UI is introduced.

## Evidence-based audit
- Legacy reference: ClusterOpt/Program/src/explorer.js.
- Old inline right-click toolbar exposes new file, rename, new folder,
  cut, copy, paste, delete, and open/close actions.
- Current ClusterOpt2 toolbar has a four-button primary and six-button
  secondary panel; the new-file action exists in Explorer.Request
  but has no context toolbar button.
- Old implementation explicitly did not support directory copy/move.
- Current implementation also reports 501 for directory paste/rename.
- Therefore right-click parity and complete functionality NOT PASS.

## Implemented fix
- Explorer paste of files verifies all destination bytes after close.
- Before retiring a cut source, verifies source remains identical.
- On error, source remains untouched, and partial destination cleanup
  is attempted; cleanup failures produce independent EHU records.
- Uses existing ExplorerEntryPolicy.verifyCopy, no duplicate property.
- Cross-object routing still uses HubUnit Request/Response.
- No new UI, tokens, machine absolute paths or unsafe file writes.

## Event chains
UI/VTE -> HubUnit -> Explorer.Request.cutEntry ->
Explorer clipboard state -> OMU Response/Log.
UI/VTE -> HubUnit -> Explorer.Request.pasteEntry ->
ExplorerEntryPolicy.ensureAbsent -> write destination ->
ExplorerEntryPolicy.verifyCopy(source,destination) ->
verified source retirement -> OMU Response/Log.

Errors: 400 invalid target; 409 transfer mismatch; 503 file API failure.
Partial destination cleanup failure creates EHU Entry.PasteCleanup.

## Load, memory, security
- verifyCopy reads at most 1 MiB from source and 1 MiB from target
  simultaneously; O(n) bytes read, O(1) peak validation buffers.
- The preexisting FileSystemWritable write(originalBlob) may incur
  browser-dependent filesystem buffering, not JS full-text allocation.
- Cross-directory symlinks and external mutation races need real
  Windows permission testing before declaring complete coverage.
- No raw user-provided path concatenation, direct disk deletion before
  verification, or UI debug prompts.

## Tests
- Mock file transfers: corrupt destination rejects source deletion;
  cleanup removes incomplete copy; retry succeeds and preserves bytes.
- OMU EHU status and existing PR1–PR7 UI regression CI.

## Open / not accepted
- Restore original create-file context action without breaking
  existing legacy menu visual tests.
- Directory recursive copy/cut and rename (currently 501).
- Native Windows permission denial, concurrent external writer and
  larger-than-1GiB real file cut/paste verification.
- All-file authoritative PieceTree/B+ slicing and true Worker CPU
  parallelism remain prior PR8 open gates.

## Patch25 Fix1: context access without toolbar redesign
- On directory rows, the existing primary context 'open' slot
  becomes the legacy 'new file' operation.
- Directory expansion remains available via the disclosure arrow.
- File rows keep 'open'; the primary/secondary 4/6-button geometry,
  glyph position, palette and language properties remain unchanged.
- Added Playwright OPFS test: right-click a real directory, create
  a named zero-byte file and verify the filesystem entry exists.
- The legacy action is restored for directory/root contexts.
