import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

function target(id, visibility, exposed = "user") {
  return {
    id, strictOCDA: true,
    authorization: { default: visibility },
    receive: async () => "executed",
    ocda: {
      Request: ["run"], Response: ["run"],
      UserAPI: exposed === "user" ? ["run"] : [],
      AgentAPI: exposed === "agent" ? ["run"] : [],
      Property: [], Program: "Test",
      EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
      APIDescriptors: [{
        apiVersion: 1, id: id.replaceAll(".", "_") + ".run",
        owner: id, action: "run", version: "1.0.0",
        visibility, sideEffect: "none",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }]
    }
  };
}

function registerProperty(core, name, visibility, readable = true) {
  const descriptor = {
    apiVersion: 1, name, type: "string",
    owners: ["Service"], visibility, readable, writable: false
  };
  assert.equal(core.hub.registerProperty(name, "private-value", {
    owners: ["Service"], visibility, descriptor
  }).status, 201);
}

test("PR02.06 hides inaccessible API and Property before pagination", () => {
  const core = new LinkCore();
  for (const id of ["guest", "Service", "Service.Child"]) {
    assert.equal(core.register({ id, receive: async () => null }), true);
  }
  for (const visibility of ["Public", "Protected", "Private"]) {
    assert.equal(core.register(target("Service." + visibility,
      visibility)), true);
    registerProperty(core, "Color" + visibility, visibility);
  }
  const guest = core.discover("guest", "list", "api",
    { limit: 1 });
  assert.equal(guest.status, 200);
  assert.equal(guest.value.total, 4);
  assert.equal(guest.value.nextOffset, 1);
  assert.equal(guest.value.items[0].descriptor.visibility, "Public");
  const own = core.discover("Service.Protected.Child", "list", "api");
  assert.equal(own.status, 404, "Unregistered source never materializes");
  assert.equal(core.register({
    id: "Service.Protected.Child", receive: async () => null
  }), true);
  const descendant = core.discover("Service.Protected.Child", "list", "api");
  assert.equal(descendant.value.total, 5);
  assert.equal(core.discover("Service.Private", "list", "api").value.total,
    5, "Private API visible to owner and Public visible to all");
  assert.equal(core.discover("guest", "list",
    "property").value.total, 1);
  assert.equal(core.discover("Service.Child", "list",
    "property").value.total, 2);
  assert.equal(core.discover("Service", "list",
    "property").value.total, 3);
});

test("PR02.06 blocks forbidden describe without existence disclosure", () => {
  const core = new LinkCore();
  core.register({ id: "guest", receive: async () => null });
  core.register(target("Admin", "Private"));
  const hidden = core.discover("guest", "describe", "api",
    { id: "Admin.run", owner: "Admin" });
  assert.equal(hidden.status, 404);
  assert.equal(core.discover("guest", "describe", "api",
    { id: "NotExist.run", owner: "Admin" }).status, 404);
  assert.equal(core.discover("guest", "query", "api",
    { term: "Admin" }).value.total, 0);
  assert.equal(core.discover("ghost", "list", "api").status, 404);
  assert.equal(core.uru.objects.has("ghost"), false);
  assert.ok(core.getSnapshot().logs.some(item =>
    item.kind === "EHU" && item.status === 404));
});

test("PR02.06 honors UserAPI, AgentAPI and non-readable properties", () => {
  const core = new LinkCore();
  core.register({ id: "guest", receive: async () => null });
  core.register(target("Service", "Public", "agent"));
  registerProperty(core, "HiddenProp", "Public", false);
  assert.equal(core.discover("guest", "list", "api").value.total, 3);
  assert.equal(core.discover("guest", "list", "api", {}, {
    origin: "agent"
  }).value.total, 4);
  assert.equal(core.discover("guest", "list",
    "property").value.total, 0);
  assert.equal(core.discover("guest", "list", "api", {}, {
    origin: "unknown"
  }).status, 400);
  assert.equal(core.discover("guest", "mutate", "api").status, 400);
  assert.equal(typeof core.hub.discoverCatalog, "function");
  assert.equal(typeof core.catalogQuery.request, "undefined");
});
