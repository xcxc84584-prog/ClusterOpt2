import test from "node:test";
import assert from "node:assert/strict";
import { CatalogVersionPolicy as policy } from
  "../property/CatalogVersionPolicy.js";
import { LinkCore } from "../LinkCore/LinkCore.js";

function descriptor(version, options = {}) {
  return {
    apiVersion: 1, id: "editor.render", owner: "Editor",
    action: "render", version,
    visibility: "Public", sideEffect: "none",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    ...options
  };
}

function register(core, version, options = {}) {
  return core.register({
    id: "Editor", strictOCDA: true,
    receive: async (_action, value) => value,
    ocda: {
      Request: ["render"], Response: ["render"],
      UserAPI: ["render"], AgentAPI: [],
      Property: [], Program: "Test", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU",
      APIDescriptors: [descriptor(version, options)]
    }
  });
}

test("PR02.07 stable compatibility and pre-release strict minor", () => {
  assert.equal(policy.inspect(descriptor("2.3.1"), "2.1.0")
    .value.compatible, true);
  assert.equal(policy.inspect(descriptor("2.3.1"), "2.4.0")
    .value.compatible, false);
  assert.equal(policy.inspect(descriptor("2.3.1"), "3.0.0")
    .value.compatible, false);
  assert.equal(policy.inspect(descriptor("0.4.7"), "0.4.2")
    .value.compatible, true);
  assert.equal(policy.inspect(descriptor("0.4.7"), "0.5.0")
    .value.compatible, false);
  assert.equal(policy.compare("2.1.0", "2.1.1"), -1);
  assert.equal(policy.compare("02.1.0", "2.1.0"), null);
  assert.equal(policy.compare("999999999999999999.1.0", "1.0.0"), null);
});

test("PR02.07 since and deprecation never authorize execution", async () => {
  const core = new LinkCore();
  core.register({ id: "guest", receive: async () => null });
  assert.equal(register(core, "2.3.0", {
    since: "2.0.0", deprecated: true
  }), true);
  const info = core.discover("guest", "describe", "api",
    { id: "editor.render", owner: "Editor" });
  assert.equal(info.status, 200);
  assert.equal(info.value.descriptor.deprecated, true);
  const assessment = policy.inspect(info.value.descriptor, "2.1.0");
  assert.equal(assessment.value.compatible, true);
  assert.equal(assessment.value.deprecated, true);
  assert.equal(policy.inspect(info.value.descriptor,
    "1.9.0").value.compatible, false);
  assert.equal(core.discover("guest", "query", "api",
    { term: "editor" }).value.total, 1);
  const result = await core.request("guest", "Editor", "render",
    { text: "hello" }, { origin: "user" });
  assert.equal(result.status, 200, "deprecated is informational only");
  assert.equal(core.getSnapshot().version, core.version);
});

test("PR02.07 rejects contradictory since and unsafe versions", () => {
  assert.equal(policy.inspect(descriptor("2.0.0", {
    since: "2.1.0"
  })).status, 400);
  assert.equal(policy.inspect(descriptor("2.0.0"),
    "2.x.0").status, 400);
  assert.equal(policy.inspect(descriptor("2.0.0"),
    "2.0.0-beta").status, 400);
  const core = new LinkCore();
  core.register({ id: "guest", receive: async () => null });
  assert.equal(register(core, "2.0.0",
    { since: "2.1.0" }), false);
  assert.equal(core.discover("guest", "list", "api").value.total, 0);
  assert.ok(core.getSnapshot().logs.some(event =>
    event.kind === "EHU" && event.status === 400));
});
