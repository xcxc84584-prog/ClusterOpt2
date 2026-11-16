# PR8 Patch(+19-Fix5): virtual file generation rebase after EHU409

## Report
Observed 50 recent EHU records; repeated pairs from
`document-1 Response.page` and `workspace Response.page`.
Visible error at event 357: `External virtual file changed`
with status 409.

## Root condition and limitations of evidence
The current VirtualFileDocument.loadPage checks the source
lastModified/size fingerprint against its cached fingerprint.
That check previously rejected changed source generations even
when there were no unsaved edits. The exact reason the user's
source fingerprint changed is not established by the abbreviated
EHU listing; it could be another file writer, a prior Save,
a replaced file or another authorized process. We must not
pretend all 409 errors are false.

## Changes
- Clean virtual file + new file generation + no active Save:
  safely reset old global line checkpoints and load the
  requested page from the new file Blob. Rebuild its PieceTree,
  B+ slice index, byte boundaries and source hash.
- Any dirty page, pending recovery, or active Save:
  reject changed source with EHU409. Keep all unsaved edits
  and SHA-256 Journal checkpoints.
- Main editor detects one failed 409 page request and suppresses
  repeated mouse wheel attempts on that document, preventing
  dozens of duplicate EHU pairs. Explicit Alt+PageUp/Down remains
  retryable. A successful page move or new edit clears the latch.
- LinkCore publishes version 0.0.8-pr8.patch19.fix5.
- No new UI; original ClusterOpt menu, tabs and editor retained.

## Tests
- Clean file generation change while viewing page 0:
  page 1 loads current file and no EHU409 emitted.
- Dirty file with outstanding MVCC checkpoint:
  changed generation remains rejected, content/journal retained.
- Reset prior file line checkpoints after external generation
  replacement; global line count follows new source.
- Existing PR1–PR7, PR8 Node and Chromium E2E, OCDA Relations.

## Scope and open risks
- Clean-source rebasing is not a substitute for versioned
  writes or 1GiB/5GiB performance testing.
- Incomplete or uncertain writeback after stream-close must retain
  journal rather than marking source clean; recovery/reconciliation
  still requires further PR8 work.
- Preserve exact previous main rollback before merge.

## CI and merge evidence (2026-11-17)
- Final tested PR #26 HEAD:
  `5a4d864860db10837c423ffaa6b4638f2f39ec6b`.
- Both `OCDA CI` and `PR1 OCDA Verification` passed
  Node/unit, verify and Chromium Playwright browser jobs.
- Changed-generation browser OPFS regression uses a size
  change to avoid coarse lastModified timestamp collisions.
  Clean file rebases, dirty source still EHU409.
- Merge SHA: `8bd90bcd277c0683982463f946f77d9e5fdea97a`.
- Rollback `backup/pre-pr8-patch19-fix5-main-20261117`
  verified identical to previous main
  `8acf91c210e7ddbdc9469f106ba2daa552595cf4`.
- PR8 still NOT PASS. Exact cause of user's source generation
  change is not proven by abbreviated logs alone.
