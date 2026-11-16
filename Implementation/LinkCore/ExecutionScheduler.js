import { ParallelExecutionPolicy } from "../property/ParallelExecutionPolicy.js";

/**
 * Bounded asynchronous scheduler.
 *
 * Different resource keys may run concurrently; operations sharing a key
 * execute FIFO, preventing overlapping writes to the same object.
 * This is asynchronous concurrency, not CPU-level worker parallelism.
 */
export class ExecutionScheduler {
  constructor({ maxConcurrency = ParallelExecutionPolicy.maxConcurrency,
    maxQueue = ParallelExecutionPolicy.maxQueue } = {}) {
    if (!Number.isSafeInteger(maxConcurrency) || maxConcurrency < 1 ||
        !Number.isSafeInteger(maxQueue) || maxQueue < 1) {
      throw new RangeError("Invalid scheduler limits");
    }
    this.maxConcurrency = maxConcurrency;
    this.maxQueue = maxQueue;
    this.pending = [];
    this.activeKeys = new Set();
    this.running = 0;
    this.nextTaskId = 1;
  }

  schedule(key, execute, options = {}) {
    if (typeof key !== "string" || !key ||
        typeof execute !== "function") {
      return Promise.reject(new TypeError("Invalid task"));
    }
    if (options.signal?.aborted) {
      return Promise.reject(this.abortError());
    }
    if (this.pending.length >= this.maxQueue) {
      return Promise.reject(new Error("Execution queue is full"));
    }
    return new Promise((resolve, reject) => {
      const task = {
        id: this.nextTaskId++, key, execute, resolve, reject,
        signal: options.signal, abortHandler: null
      };
      if (task.signal) {
        task.abortHandler = () => {
          const index = this.pending.indexOf(task);
          if (index < 0) return;
          this.pending.splice(index, 1);
          task.reject(this.abortError());
          this.pump();
        };
        task.signal.addEventListener("abort", task.abortHandler, {
          once: true
        });
      }
      this.pending.push(task);
      this.pump();
    });
  }

  abortError() {
    const error = new Error("Queued operation was aborted");
    error.name = "AbortError";
    return error;
  }

  pump() {
    while (this.running < this.maxConcurrency) {
      // Preserve FIFO per key: only the oldest queued task for a key
      // can start while that resource is unlocked.
      const index = ParallelExecutionPolicy.selectRunnableIndex(
        this.pending, this.activeKeys);
      if (index < 0) break;
      const [task] = this.pending.splice(index, 1);
      if (task.abortHandler) {
        task.signal.removeEventListener("abort", task.abortHandler);
      }
      this.activeKeys.add(task.key);
      this.running++;
      Promise.resolve()
        .then(task.execute)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.activeKeys.delete(task.key);
          this.running--;
          this.pump();
        });
    }
  }

  snapshot() {
    return Object.freeze({
      maxConcurrency: this.maxConcurrency,
      running: this.running,
      queued: this.pending.length,
      activeKeys: [...this.activeKeys]
    });
  }
}
