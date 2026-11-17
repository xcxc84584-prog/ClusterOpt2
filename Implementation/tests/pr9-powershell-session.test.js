import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { PowerShellSessionManager } from "../object/PowerShellSessionManager.js";
import { PowerShellConnectionPolicy as policy } from
  "../property/PowerShellConnectionPolicy.js";

test("PR9 native session life cycle routes through HubUnit", async () => {
  const core = new LinkCore();
  new PowerShellSessionManager(core);
  const call = (action, payload = {}) =>
    core.request("ui", "powershell-session-manager", action, payload);
  const first = await call("create");
  assert.equal(first.status, 200);
  assert.equal(first.value.sessions.length, 1);
  const second = await call("create");
  assert.equal(second.value.sessions.length, 2);
  const close = await call("close", { id: first.value.activeId });
  assert.equal(close.status, 200);
  assert.equal(close.value.sessions.length, 1);
  const invalid = await call("close", { id: 999 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 404);
  assert.ok(core.getSnapshot().logs.some(log => log.status === 404 ||
    log.code === 404));
});

test("PR9 native terminal connection rejects unsafe pairing values", () => {
  assert.equal(policy.port(43881), 43881);
  assert.equal(policy.socketUrl(43881),
    "ws://127.0.0.1:43881/terminal/ws");
  assert.throws(() => policy.port(80), RangeError);
  assert.throws(() => policy.token("bad"), TypeError);
  assert.equal(policy.token("a".repeat(64)).length, 64);
});
