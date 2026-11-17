import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from "../LinkCore/VirtualTestEnvironment.js";

function provider(owner, id, visibility = "Public") {
  return {
    id: owner, strictOCDA: true,
    authorization: { default: visibility },
    receive: async () => ({ unexpected: "execution" }),
    ocda: {
      Request: ["run"], Response: ["run"],
      UserAPI: ["run"], AgentAPI: [], Property: [],
      Program: "Catalog VTE", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU",
      APIDescriptors: [{
        apiVersion: 1, owner, id, action: "run",
        version: "1.0.0", visibility, sideEffect: "none",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }]
    }
  };
}

test("PR02.09 detached VTE audits 400/403/404/409 EHU", async () => {
  const env = new VirtualTestEnvironment();
  const core = env.core;
  assert.equal(core.register({ id: "reader", receive: async () => null }),
    true);
  assert.equal(core.register(provider("Api.A", "shared.run")), true);
  assert.equal(core.register(provider("Api.B", "shared.run")), true);
  assert.equal(core.register(provider("Api.Secret", "secret.run",
    "Private")), true);

  const cases = [
    [400, core.discover("reader", "unsupported", "api")],
    [400, core.discover("reader", "list", "api", { limit: 101 })],
    [404, core.discover("missing", "list", "api")],
    [404, core.discover("reader", "describe", "api",
      { id: "secret.run", owner: "Api.Secret" })],
    [409, core.discover("reader", "describe", "api",
      { id: "shared.run" })]
  ];
  for (const [expected, result] of cases) {
    assert.equal(result.ok, false);
    assert.equal(result.status, expected);
  }
  assert.equal(core.discover("reader", "describe", "api",
    { id: "never.existed" }).status, 404);

  const denied = await core.request("reader", "Api.Secret", "run");
  assert.equal(denied.status, 403);
  const statusSet = [400, 403, 404, 409];
  for (const status of statusSet) {
    assert.ok(env.log().some(event =>
      event.kind === "EHU" && event.status === status),
    "Missing EHU status " + status);
  }
  const ehus = env.log().filter(event =>
    event.kind === "EHU" && statusSet.includes(event.status));
  assert.ok(ehus.length >= 6);
  assert.ok(ehus.every(event =>
    Number.isSafeInteger(event.eventId) && event.eventId > 0 &&
    typeof event.action === "string"));
  assert.equal(new Set(ehus.map(event => event.eventId)).size,
    ehus.length, "Every failure keeps a unique Event ID");
  assert.equal(core.uru.objects.has("missing"), false);
  assert.equal(core.discover("reader", "list", "api").status, 200);
  assert.equal(env.snapshot().dependencies.length, 0,
    "Catalog metadata requests never execute a provider");
});

test("PR02.09 oversized documentation returns 413 and durable EHU", () => {
  const env = new VirtualTestEnvironment();
  const core = env.core;
  assert.equal(core.register({ id: "reader", receive: async () => null }),
    true);
  for (let index = 0; index < 90; index++) {
    const object = provider("Extra" + index, "extra." + index);
    object.ocda.APIDescriptors[0].description = "x".repeat(800);
    assert.equal(core.register(object), true);
  }
  const oversized = core.generateCatalogDocs("reader", "json");
  assert.equal(oversized.status, 413);
  assert.equal(oversized.ok, false);
  assert.equal(Object.hasOwn(oversized, "value"), false);
  assert.ok(env.log().some(event =>
    event.kind === "EHU" && event.status === 413 &&
    event.action === "Catalog.Document" && event.source === "reader"));
  const invalid = core.generateCatalogDocs("reader", "xml");
  assert.equal(invalid.status, 400);
  assert.ok(env.log().some(event =>
    event.kind === "EHU" && event.status === 400 &&
    event.action === "Catalog.Document"));
  assert.equal(core.discover("reader", "list", "api",
    { limit: 1 }).status, 200);
});
