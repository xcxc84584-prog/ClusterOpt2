# EditCommitter API — proposal v1

Status: specification only. Custom execution is not enabled in Patch(+8).

## Contract
- Stage: after an edit transaction and before the durable writeback.
- Input: { apiVersion: 1, documentId, sliceId, baseRevision,
  proposedText, editRange, operationId }.
- Output: { apiVersion: 1, operationId, baseRevision,
  accepted, proposedText, diagnostics }.
- Committed text must not be modified without a recorded transaction.
- No plugin directly writes filesystem handles or deletes MVCC history.

## Modules
- Default: MVCC revision maintenance, keyboard shortcut handling.
- Each default may be independently disabled in a future release.
- When MVCC is disabled, core must still reject stale writes and
  preserve recovery snapshots or refuse unsafe commit.

## Safety
- Revision mismatch -> EHU 409, invalid input -> 400.
- Deadline/resource limit -> 408/413; storage failure -> 503.
- On failure do not mutate active document or stored file.
- Run plugins with bounded permissions and explicit enablement.
- HubUnit manages the cross-object event chain and OMU records it.

## Lifecycle
register -> enable -> validate -> commit -> disable -> unregister.
