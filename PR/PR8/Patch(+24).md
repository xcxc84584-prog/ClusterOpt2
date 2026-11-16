# PR8 Patch(+24): bounded acceptance preparation

## Goal
Run PR8 acceptance over the full six-stage slice path, including
virtual descriptors, loader/registry, processor API boundary,
editor, MVCC and durable verified writeback, and recovery lifecycle.

## Acceptance gates
- A1: all text sizes use bounded resident slices; no legacy
  full-buffer path at runtime
- A2: save/reload and page-to-line/viewport restoration stable
- A3: fast scroll/jump and zoom under 1 GiB/5 GiB stress
- A4: independent document residency / parallel scheduler fairness
- A5: unsaved MVCC journal retained under disk conflicts and crashes
- A6: plugin import/processor/committer security and compatibility
- A7: Explorer parity and local Windows permissions/locks
- A8: all EventChains VTE PASS; OMU EHU/Log/Dependency stable
- A9: Node, Chromium, CI and rollback verified

## Current evidence
- Patch22 added uniform contract, but still reports legacy compatibility.
- Patch23 fixes cross-document viewport guard and duplicate navigation.
- Patch24 starts test inventory only. Do not claim PR8 PASS.
- CI and browser results are commit-specific. Record them when available.

## Status
NOT ACCEPTED. Remaining requirements tracked in issue list.

## Synthetic sparse file gate
- Added pr8-patch24-sparse-large-metadata.test.js.
- Simulates 1/5 GiB Blob size and throws if any eager slice read occurs.
- Metadata-only open/close must succeed with no Blob body reads.
- This does not replace true Windows 1/5 GiB I/O or crash QA.

## Patch(+24-Fix1) acceptance evidence
- Added sparse 5 GiB random byte-index navigation test with bounded reads.
- Not a real file I/O benchmark; disk crash and 1/5 GiB writeback OPEN.
- Loader has concurrent Blob read batches, NOT Worker CPU execution.
- Full legacy FileDocument replacement remains OPEN and PR8 NOT PASS.
