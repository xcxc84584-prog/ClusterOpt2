# PR8 Patch(+19-Fix1): navigation, Save and Close repair

## Problem
- Backwards virtual navigation reset caret/scroll to the first line,
  rather than entering the previous page at its last line.
- Forwards page transitions must enter at first line.
- Dirty virtual documents could only return 409 on Close; users had
  no safe Save and Close path.
- Prior 65 MiB OPFS Save browser suite did not await a fully populated
  64 KiB page before starting an equal-length replacement. The
  resulting size mismatch was a test race, not an established
  writeback truncation defect; retaining the byte-size assertion
  detects a real regression.

## Implementation
- VirtualFileDocument.receive(page) records direction and sets
  `pageEntryEdge=end`, `cursor=text.length` when index decreases;
  forward navigation resets to start via existing loadPage.
- Original editor DOM render now restores viewport scroll to
  scrollHeight for end-entry and 0 for start-entry, synchronizing
  line number gutter. Does not add or redesign any UI.
- FileWorkspace.close becomes async only for the operation's caller:
  dirty virtual page asks via the original window.confirm,
  affirmative invokes doc.save through HubUnit, verifies success
  and then closes; cancel preserves document/journal, save failure
  preserves document/journal and returns EHU.
- New shared Language keys zh-Hant/en for save-before-close prompt.
- LinkCore centrally publishes version 0.0.8-pr8.patch19.fix1.
- Playwright: (1) next/previous caret and page continuity;
  (2) actual 65 MiB OPFS equal-length edit, Ctrl+S, byte-size
  verification and tab close;
  (3) dirty Close cancel and confirm-save path.
- EHU: 409 dirty page navigation, 503 writer failures;
  200 verified save and close; cancel preserves state.

## OCDA EventChain
UI.Close -> Hub -> FileWorkspace.close ->
  Language via EDPMU -> original confirm ->
  Hub -> VirtualFileDocument.save ->
  Hub -> SliceEditTransaction.commitWriteback ->
  Hub -> SliceWritebackUnit.commit ->
  IndexedDB checkpoint verification + byte-stream readback ->
  checkpoint retirement -> FileWorkspace.unregister -> OMU.
Cancel stops before save; failed commit leaves dirty tab in place.

## Risk / limits
- Original FileDocument and styling are unchanged.
- Full disk write still O(file bytes) even if slice is 64 KiB.
- Does not deliver contiguous gigabyte virtual scrolling,
  arbitrary cross-page transactions or 5 GiB performance.
- File permissions and OS-external races are not universally atomic.
- CI must pass on final head and previous-main backup must be
  verified before any main merge.
