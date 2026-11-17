import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { RouteTablePolicy } from "../property/RouteTablePolicy.js";

const SERVICE = "test.response";
const OBJ = { type: "object" };
const STR = { type: "string" };
const BOOL = { type: "boolean" };
const FAN = { type: "array", items: { type: "object" } };

function object(core, id, handler, access = "Public") {
  core.register({
    id, authorization: { run: access },
    receive: async (_action, payload) => handler(payload),
    ocda: { Request: ["run"], Response: [], UserAPI: ["run"],
      AgentAPI: ["run"], Property: [], Program: {}, EHU: [], Log: [] }
  });
}
function manifest(id, providerId, input, output) {
  return {
    manifestVersion: 1, providerId, objectId: id,
    provides: [{ service: SERVICE, action: "run", version: "1.0.0",
      inputSchema: input, outputSchema: output }],
    requires: [], permissions: [],
    execution: { isolation: "host", concurrency: "parallel" }
  };
}
function add(core, id, providerId, handler, input, output,
  access = "Public") {
  object(core, id, handler, access);
  assert.equal(core.registerProvider(id,
    manifest(id, providerId, input, output)).status, 201);
}
function route(providers, responsePipeline, mode = "replace") {
  return {
    routeId: "test.pipeline", service: SERVICE, action: "run",
    mode, providers,
    sourceFilter: { origins: ["user", "agent"], objects: [] },
    priority: 0, timeoutMs: 3000,
    ...(responsePipeline ? { responsePipeline } : {})
  };
}
const step = (kind, providerId) => ({ kind, providerId });
function configure(core, routes) {
  return core.configureServiceRoutes({ schemaVersion: 1, routes });
}
function start() {
  const core = new LinkCore();
  object(core, "Caller", x => x);
  add(core, "Primary", "vendor.primary", x => x.text,
    OBJ, STR);
  return core;
}
const call = (core, text = "hello") => core.requestService(
  "Caller", SERVICE, "run", { text }, { origin: "user" });

test("PR04.07 validate and transform preserve original Hub envelope",
  async () => {
    const core = start();
    const inputFrozen = [];
    add(core, "Gate", "vendor.gate", input => {
      inputFrozen.push(Object.isFrozen(input));
      return input.length > 0;
    }, STR, BOOL);
    add(core, "Format", "vendor.format", input => input + "!",
      STR, STR);
    assert.equal(configure(core, [route(["vendor.primary"], [
      step("validate", "vendor.gate"),
      step("transform", "vendor.format")
    ])]).status, 200);
    const result = await call(core);
    assert.deepEqual(result, { ok: true, status: 200, value: "hello!" });
    assert.deepEqual(inputFrozen, [true]);
    assert.ok(core.getSnapshot().dependencies.some(item =>
      item.link === "Caller->Format" && item.code === "10"));
    assert.ok(core.getSnapshot().dependencies.some(item =>
      item.link === "Format->Caller" && item.code === "01"));
  });

test("PR04.07 validation false rejects without later transform",
  async () => {
    const core = start();
    let touched = 0;
    add(core, "Gate", "vendor.gate", () => false, STR, BOOL);
    add(core, "Format", "vendor.format", x => {
      touched++;
      return x + "!";
    }, STR, STR);
    assert.equal(configure(core, [route(["vendor.primary"], [
      step("validate", "vendor.gate"),
      step("transform", "vendor.format")
    ])]).status, 200);
    assert.equal((await call(core)).status, 422);
    assert.equal(touched, 0);
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" &&
      item.action === "Service.Route.Execute" &&
      item.status === 422));
  });

test("PR04.07 invalid output and ACL failures fail closed",
  async () => {
    const core = start();
    add(core, "Format", "vendor.format", () => 15, STR, STR);
    assert.equal(configure(core, [route(["vendor.primary"], [
      step("transform", "vendor.format")
    ])]).status, 200);
    assert.equal((await call(core)).status, 502);
    core.unregister("Format");
    add(core, "Format", "vendor.format", x => x,
      STR, STR, "Private");
    assert.equal((await call(core)).status, 403);
    assert.ok(core.getSnapshot().logs.some(item =>
      item.kind === "EHU" && item.status === 403));
  });

test("PR04.07 atomic config rejects missing, mismatch and illegal aggregate",
  async () => {
    const core = start();
    add(core, "Format", "vendor.format", x => x + "!",
      STR, STR);
    const good = route(["vendor.primary"], [
      step("transform", "vendor.format")
    ]);
    assert.equal(configure(core, [good]).status, 200);
    assert.equal(configure(core, [route(["vendor.primary"], [
      step("transform", "vendor.missing")
    ])]).status, 404);
    assert.equal(configure(core, [route(["vendor.primary"], [
      step("aggregate", "vendor.format")
    ])]).status, 400);
    add(core, "Bad", "vendor.bad", x => x, OBJ, STR);
    assert.equal(configure(core, [route(["vendor.primary"], [
      step("transform", "vendor.bad")
    ])]).status, 409);
    assert.equal((await call(core)).value, "hello!");
    assert.equal(RouteTablePolicy.validate({
      schemaVersion: 1, routes: [route(["vendor.primary"], [
        step("validate", "vendor.format"),
        step("validate", "vendor.format")
      ])]
    }).status, 400);
  });

test("PR04.07 fanout aggregate uses provider-declaration order",
  async () => {
    const core = start();
    add(core, "Second", "vendor.second", x => x.text + "2",
      OBJ, STR);
    add(core, "Aggregate", "vendor.aggregate", input =>
      input.map(item => item.value).join("|"), FAN, STR);
    assert.equal(configure(core, [route(
      ["vendor.primary", "vendor.second"],
      [step("aggregate", "vendor.aggregate")], "fanout"
    )]).status, 200);
    assert.equal((await call(core)).value, "hello|hello2");
  });

test("PR04.07 disabled pipeline Provider returns 404, no fallback",
  async () => {
    const core = start();
    add(core, "Format", "vendor.format", x => x + "!",
      STR, STR);
    assert.equal(configure(core, [route(["vendor.primary"], [
      step("transform", "vendor.format")
    ])]).status, 200);
    assert.equal(core.setProviderEnabled(
      "Format", "vendor.format", false).status, 200);
    assert.equal((await call(core)).status, 404);
  });

test("PR04.07 policy rejects hostile declarative data, VTE isolated",
  async () => {
    const base = route(["vendor.primary"], [
      step("validate", "vendor.gate")
    ]);
    const bad = {
      ...base, responsePipeline: [
        { kind: "transform", providerId: "vendor.format", extra: 1 }
      ]
    };
    assert.equal(RouteTablePolicy.validate({
      schemaVersion: 1, routes: [bad]
    }).status, 400);
    const getter = route(["vendor.primary"], [
      step("transform", "vendor.format")
    ]);
    Object.defineProperty(getter.responsePipeline[0], "kind", {
      enumerable: true, get() { throw Error("accessor"); }
    });
    assert.equal(RouteTablePolicy.validate({
      schemaVersion: 1, routes: [getter]
    }).status, 400);
    const vte = new VirtualTestEnvironment();
    assert.equal(vte.core.hub.replaceRoutes.length, 0);
    assert.equal(typeof vte.core.requestService, "function");
  });
