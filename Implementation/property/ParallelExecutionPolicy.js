/**
 * Shared scheduling policy (the "brain").
 * ExecutionScheduler is the object/API (the "hand").
 *
 * Policy functions are pure and do not touch DOM or file handles.
 */
export const ParallelExecutionPolicy = Object.freeze({
  maxConcurrency: 4,
  maxQueue: 1024,
  resourceKey: target => target,
  selectRunnableIndex(pending, activeKeys) {
    return pending.findIndex(task => !activeKeys.has(task.key));
  }
});
