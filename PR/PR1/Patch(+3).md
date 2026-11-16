# Patch(+3): parallelizable asynchronous execution

## Changes
- Add ExecutionScheduler (per-resource FIFO + global concurrency limit).
- Integrate scheduler into HubUnit Request/Response pipeline.
- Add queue bounds and AbortSignal cancellation of queued tasks.
- Emit EHU 429 on overload and 499 on cancelled waiting task.
- Add scheduler tests for overlap, FIFO, failures and capacity.
- Update Plan and ArcD with flowchart, load rules and limitations.

## Important limitation
Promise concurrency allows overlapping asynchronous I/O; it does not
parallelize CPU-bound JavaScript on the browser main thread.
Web Worker execution is not implemented.
Deadlock prevention for recursive same-resource requests is also pending.

## Acceptance state
Not complete. CI and browser runtime results not yet verified.
