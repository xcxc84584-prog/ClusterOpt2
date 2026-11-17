import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PluginArtifactPolicy } from
  "../property/PluginArtifactPolicy.js";
import { PluginSourcePolicy } from
  "../property/PluginSourcePolicy.js";
import { PluginMessagePolicy } from
  "../property/PluginMessagePolicy.js";
import { TrustedPluginWorkerUnit } from
  "../LinkCore/TrustedPluginWorkerUnit.js";
import { LinkCore } from "../LinkCore/LinkCore.js";

test("PR06.07 verifies pinned bytes but never enables execution", async () => {
  const bytes = new TextEncoder().encode("trusted-plugin-package");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const verified = await PluginArtifactPolicy.verify(bytes, hash);
  assert.equal(verified.status, 200);
  assert.equal(verified.value.sha256, hash);
  assert.equal(verified.value.byteLength, bytes.byteLength);
  bytes[0] = 1;
  assert.equal((await PluginArtifactPolicy.verify(bytes, hash))
    .status, 412);
  assert.equal(PluginSourcePolicy.inspect({
    kind: "https", sha256: hash
  }).status, 400);
  assert.equal(PluginSourcePolicy.inspect({ kind: "remote" })
    .status, 403);
});

test("PR06.07 rejects forged or oversized artifact and digest", async () => {
  const hash = "0".repeat(64);
  for (const [bytes, digest] of [
    [new Uint8Array(0), hash],
    [new Uint8Array(1024 * 1024 + 1), hash],
    [new Uint8Array([1]), "invalid"],
    [new Uint8Array([1]), hash.toUpperCase()],
    [new ArrayBuffer(5), hash],
    [null, hash]
  ]) {
    assert.equal((await PluginArtifactPolicy.verify(bytes, digest))
      .status, 400);
  }
});

test("PR06.09 forged Worker reply logs sanitized EHU", async () => {
  const core = new LinkCore();
  let ended = false;
  const adapter = new TrustedPluginWorkerUnit(core.omu, () => ({
    postMessage(msg) {
      queueMicrotask(() => this.onmessage({
        data: { id: msg.id, ok: true, value: new Date() }
      }));
    },
    terminate() { ended = true; }
  }));
  assert.equal((await adapter.invoke("echo", {})).status, 502);
  assert.equal(ended, true);
  const log = core.getSnapshot().logs.find(event =>
    event.action === "Plugin.Worker.Invoke" &&
    event.kind === "EHU" && event.status === 502);
  assert.ok(log);
  assert.equal(JSON.stringify(log).includes("payload"), false);
});

test("PR06.10 adversarial request: getters and unsafe values denied",
  async () => {
    const core = new LinkCore();
    let spawned = 0;
    const adapter = new TrustedPluginWorkerUnit(core.omu, () => {
      spawned++;
      return { postMessage() {}, terminate() {} };
    });
    const malicious = {};
    Object.defineProperty(malicious, "secrets", {
      enumerable: true, get() { throw Error("unexpected"); }
    });
    assert.equal((await adapter.invoke("echo", malicious))
      .status, 400);
    assert.equal((await adapter.invoke("echo", { eval: () => 1 }))
      .status, 400);
    assert.equal(spawned, 0);
    assert.equal(PluginMessagePolicy.inspect(
      { data: new Blob(["data"]) }).status, 400);
});
