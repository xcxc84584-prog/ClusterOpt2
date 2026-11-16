import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionScheduler } from "../LinkCore/ExecutionScheduler.js";
import { LinkCore } from "../LinkCore/LinkCore.js";

function deferred() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

test("different objects execute concurrently", async () => {
  const scheduler = new ExecutionScheduler({ maxConcurrency: 2 });
  const gate = deferred();
  const started = [];
  const a = scheduler.schedule("A", async () => {
    started.push("A");
    await gate.promise;
  });
  const b = scheduler.schedule("B", async () => {
    started.push("B");
    await gate.promise;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(started, ["A", "B"]);
  assert.equal(scheduler.snapshot().running, 2);
  gate.release();
  await Promise.all([a, b]);
});

test("same object maintains FIFO and exclusive execution", async () => {
  const scheduler = new ExecutionScheduler({ maxConcurrency: 4 });
  const gate = deferred();
  const order = [];
  const a = scheduler.schedule("doc", async () => {
    order.push("start1");
    await gate.promise;
    order.push("end1");
  });
  const b = scheduler.schedule("doc", async () => {
    order.push("start2");
  });
  await Promise.resolve();
  assert.deepEqual(order, ["start1"]);
  assert.equal(scheduler.snapshot().queued, 1);
  gate.release();
  await Promise.all([a, b]);
  assert.deepEqual(order, ["start1", "end1", "start2"]);
});

test("maxConcurrency bounds global active tasks", async () => {
  const scheduler = new ExecutionScheduler({ maxConcurrency: 2 });
  const gate = deferred();
  let active = 0;
  let peak = 0;
  const tasks = Array.from({ length: 12 }, (_, i) =>
    scheduler.schedule("doc-" + i, async () => {
      active++;
      peak = Math.max(peak, active);
      await gate.promise;
      active--;
    }));
  await Promise.resolve();
  assert.equal(peak, 2);
  gate.release();
  await Promise.all(tasks);
  assert.equal(scheduler.snapshot().running, 0);
});

test("task failures release the resource lock", async () => {
  const scheduler = new ExecutionScheduler({ maxConcurrency: 1 });
  const failure = scheduler.schedule("doc", () => {
    throw new Error("expected");
  });
  const success = scheduler.schedule("doc", () => 200);
  await assert.rejects(failure, /expected/);
  assert.equal(await success, 200);
  assert.equal(scheduler.snapshot().queued, 0);
});

test("queue limit rejects excess task; cancellation removes waiting task", async () => {
  const scheduler = new ExecutionScheduler({
    maxConcurrency: 1, maxQueue: 1
  });
  const gate = deferred();
  const running = scheduler.schedule("A", () => gate.promise);
  const controller = new AbortController();
  const queued = scheduler.schedule("B", () => 2, {
    signal: controller.signal
  });
  await assert.rejects(
    scheduler.schedule("C", () => 3),
    /queue is full/
  );
  controller.abort();
  await assert.rejects(queued, { name: "AbortError" });
  gate.release();
  await running;
});

test("HubUnit uses per-object scheduling and records response errors", async () => {
  const core = new LinkCore();
  const gate = deferred();
  let active = 0;
  let peak = 0;
  core.register({ id: "ui", receive: async () => null });
  core.register({
    id: "doc", receive: async action => {
      active++;
      peak = Math.max(peak, active);
      await gate.promise;
      active--;
      if (action === "fail") throw new Error("failure");
      return 200;
    }
  });
  const a = core.request("ui", "doc", "save");
  const b = core.request("ui", "doc", "fail");
  await Promise.resolve();
  assert.equal(peak, 1);
  gate.release();
  const [success, failure] = await Promise.all([a, b]);
  assert.equal(success.status, 200);
  assert.equal(failure.status, 500);
  assert.equal(peak, 1);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" && event.status === 500));
});
