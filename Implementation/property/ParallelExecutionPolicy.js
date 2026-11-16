/**
 * Pure scheduling algorithm — shared Property (brain).
 * Scheduler Object owns its queue, locks and execution lifecycle (hand).
 */
export const ParallelExecutionPolicy = Object.freeze({
  maxConcurrency: 4,
  maxNested: 8,
  maxQueue: 1024,
  resourceKey: target => target,
  selectRunnableIndex(pending, activeKeys, normalSlot, nestedSlot) {
    return pending.findIndex((task, index) => {
      if (activeKeys.has(task.key)) return false;
      if (!normalSlot && !(task.nested && nestedSlot)) return false;
      // Never allow a later nested request to overtake an earlier
      // request for the same object.
      return pending.findIndex(other => other.key === task.key) === index;
    });
  }
});
