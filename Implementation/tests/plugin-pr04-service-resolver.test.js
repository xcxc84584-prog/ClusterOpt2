import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function object(id, visibility = "Public", agent = true) {
  return {
    id,
    authorization: { highlight: visibility },
    receive: async (action, payload) =>
      action === "highlight" ? payload.text : null,
    ocda: {
      Request: ["highlight"], Response: [],
      UserAPI: ["highlight"], AgentAPI: agent ? ["highlight"] : [],
      Property: [], Program: {}, EHU: [], Log: []
    }
  };
}
function manifest(objectId, providerId) {
  return {
    manifestVersion: 1, providerId, objectId,
    provides: [{
      service: "editor.highlight", action: "highlight",
      version: "1.0.0", inputSchema: { type: "object" },
      outputSchema: { type: "string" }
    }],
    requires: [], permissions: [],
    execution: { isolation: "worker", concurrency: "serial" }
  };
}
test("PR04.01 preserves target-ID and dispatches one logical Service",
  async () => {
    const core = new LinkCore();
    core.register(object("Caller"));
    core.register(object("Renderer"));
    assert.equal(core.registerProvider("Renderer",
      manifest("Renderer", "vendor.renderer")).status, 201);
    const old = await core.request("Caller", "Renderer",
      "highlight", { text: "old" });
    const service = await core.requestService("Caller",
      "editor.highlight", "highlight", { text: "new" },
      { origin: "user" });
    assert.equal(old.value, "old");
    assert.deepEqual(service, { ok: true, status: 200, value: "new" });
    const snapshot = core.getSnapshot();
    assert.ok(snapshot.logs.some(event =>
      event.action === "Service.Resolve" && event.status === 200));
    assert.deepEqual(snapshot.dependencies, [
      { link: "Caller->Renderer", code: "10" },
      { link: "Renderer->Caller", code: "01" }
    ]);
  });
test("PR04.01 failure codes, ambiguity and disable/enable are bounded",
  async () => {
    const core = new LinkCore();
    for (const id of ["Caller", "A", "B"]) core.register(object(id));
    assert.equal(core.registerProvider("A",
      manifest("A", "vendor.first")).status, 201);
    assert.equal(core.registerProvider("B",
      manifest("B", "vendor.second")).status, 201);
    assert.equal((await core.requestService("Caller",
      "BAD.Service", "highlight")).status, 400);
    assert.equal((await core.requestService("Caller",
      "editor.highlight", "bad_action")).status, 400);
    assert.equal((await core.requestService("Caller",
      "editor.highlight", "other")).status, 404);
    assert.equal((await core.requestService("Caller",
      "missing.service", "highlight")).status, 404);
    assert.equal((await core.requestService("Missing",
      "editor.highlight", "highlight")).status, 404);
    assert.equal((await core.requestService("Caller",
      "editor.highlight", "highlight")).status, 409);
    assert.equal(core.getSnapshot().dependencies.length, 0);
    assert.ok(core.getSnapshot().logs.filter(event =>
      event.kind === "EHU" &&
      event.action === "Service.Resolve").length >= 5);
    core.setProviderEnabled("B", "vendor.second", false);
    assert.equal((await core.requestService("Caller",
      "editor.highlight", "highlight", { text: "ok" })).value, "ok");
    core.setProviderEnabled("B", "vendor.second", true);
    assert.equal((await core.requestService("Caller",
      "editor.highlight", "highlight")).status, 409);
  });
test("PR04.01 preserves AgentAPI, UserAPI and AccessPolicy gates",
  async () => {
    const core = new LinkCore();
    core.register(object("Caller"));
    core.register(object("Private", "Private", false));
    core.registerProvider("Private", manifest("Private",
      "vendor.private"));
    assert.equal((await core.requestService("Caller",
      "editor.highlight", "highlight", {}, { origin: "user" }))
      .status, 403);
    assert.equal((await core.requestService("Private",
      "editor.highlight", "highlight", {}, { origin: "agent" }))
      .status, 403);
    assert.equal((await core.requestService("Private",
      "editor.highlight", "highlight", { text: "ok" },
      { origin: "user" })).value, "ok");
    assert.equal((await core.requestService("Caller",
      "editor.highlight", "highlight", {}, null)).status, 400);
    assert.ok(core.getSnapshot().logs.some(event =>
      event.kind === "EHU" && event.status === 403));
  });
test("PR04.01 VTE has no implicit factory or registry persistence",
  async () => {
    const env = new VirtualTestEnvironment();
    env.core.register(object("VTE.Provider"));
    env.core.registerProvider("VTE.Provider",
      manifest("VTE.Provider", "vendor.vte"));
    let factories = 0;
    assert.equal(env.core.attachProviderFactory("VTE.Provider",
      "vendor.vte", () => {
        factories++;
        return { dispose() {} };
      }).status, 201);
    assert.equal((await env.core.requestService("VTE",
      "editor.highlight", "highlight", { text: "vte" })).value, "vte");
    assert.equal(factories, 0);
    assert.deepEqual(env.snapshot().dependencies, [
      { link: "VTE->VTE.Provider", code: "10" },
      { link: "VTE.Provider->VTE", code: "01" }
    ]);
    env.core.unregister("VTE.Provider");
    assert.equal((await env.core.requestService("VTE",
      "editor.highlight", "highlight")).status, 404);
    assert.equal(new LinkCore().services.resolve(
      "editor.highlight").status, 404);
  });
