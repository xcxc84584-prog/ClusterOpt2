import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { createClusterAPIFacade } from
  "../LinkCore/ClusterAPIFacade.js";

const descriptor = (owner, visibility = "Public", agentOnly = false) => ({
  id: owner,
  strictOCDA: true,
  authorization: { default: visibility },
  receive: async () => { throw Error("Catalog executed provider"); },
  ocda: {
    Request: ["run"], Response: ["run"],
    UserAPI: agentOnly ? [] : ["run"],
    AgentAPI: agentOnly ? ["run"] : [],
    Property: [], Program: "Catalog fixture",
    EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
    APIDescriptors: [{
      apiVersion: 1, owner, id: owner + ".run", action: "run",
      version: "1.0.0", visibility, sideEffect: "none",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" }
    }]
  }
});

test("PR02.10 facade is readonly, Hub-scoped and non-impersonating", () => {
  const core = new LinkCore();
  const api = createClusterAPIFacade(core);
  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(Object.keys(api).sort(),
    ["describe", "docs", "list", "query"]);
  assert.equal(api.list("api").status, 404,
    "Unknown UI caller must not be auto-registered");
  core.register({ id: "ui", receive: async () => null });
  core.register(descriptor("PublicProvider"));
  core.register(descriptor("PrivateProvider", "Private"));
  core.register(descriptor("AgentOnly", "Public", true));
  assert.equal(api.list("api").status, 200);
  assert.equal(api.list("api").value.total, 1);
  assert.equal(api.describe("api", "PrivateProvider.run",
    "PrivateProvider").status, 404);
  assert.equal(api.describe("api", "PublicProvider.run",
    "PublicProvider").status, 200);
  assert.equal(api.query("api", { term: "Public" }).value.total, 1);
  assert.equal(api.query("api", {}, { origin: "agent" }).value.total, 1,
    "Public API cannot select agent-origin private projection");
  assert.equal(api.describe("api", "AgentOnly.run",
    "AgentOnly").status, 404);
  assert.equal(api.list("api", { limit: 101 }).status, 400);
  const json = api.docs("json");
  assert.equal(json.status, 200);
  assert.equal(JSON.stringify(json).includes("PrivateProvider"), false);
  assert.equal(api.docs("xml").status, 400);
  assert.ok(core.getSnapshot().logs.some(x =>
    x.kind === "EHU" && x.status === 404));
  assert.equal(core.getSnapshot().dependencies.length, 0);
});

test("PR02.10 public facade has no mutation or execution capability", () => {
  const core = new LinkCore();
  core.register({ id: "ui", receive: async () => null });
  const api = createClusterAPIFacade(core);
  assert.equal(api.register, undefined);
  assert.equal(api.request, undefined);
  assert.equal(api.readProperty, undefined);
  assert.equal(api.unbindRoute, undefined);
  assert.equal(api.list("api").status, 200);
  assert.equal(api.describe("api", "nothing").status, 404);
  assert.equal(api.list("other").status, 400);
});
