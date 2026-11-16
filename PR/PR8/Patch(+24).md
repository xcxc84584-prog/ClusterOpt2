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
