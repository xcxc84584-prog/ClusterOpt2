/**
 * PR01 real LinkCore / VTE audit in a detached in-memory domain.
 * No browser/file handles; use node Implementation/tools/ocda-runtime-audit.mjs
 */
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment } from "../LinkCore/VirtualTestEnvironment.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

function contract(actions = ["echo"], userAPI = actions) {
  return Object.freeze({
    Request: actions, Response: actions,
    UserAPI: userAPI, AgentAPI: [], Property: [],
    Program: "AuditObject", EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
  });
}
function assertAudit(condition, message) {
  if (!condition) throw new Error("OCDA audit FAIL: " + message);
}
export async function runRuntimeAudit() {
  const core = new LinkCore();
  const caller = {
    id: "Audit.Caller", parentPath: "Audit", strictOCDA: true,
    ocda: contract(), authorization: { default: "Public" },
    receive: async () => null
  };
  const root = {
    id: "Audit", strictOCDA: true,
    ocda: contract(), authorization: { default: "Public" },
    receive: async () => null
  };
  const target = {
    id: "Audit.Target", parentPath: "Audit", strictOCDA: true,
    ocda: contract(["echo", "secret"], ["echo"]),
    authorization: { default: "Public", secret: "Private" },
    receive: async (action, payload) =>
      action === "echo" ? payload : "hidden"
  };
  assertAudit(core.register(root), "root registration");
  assertAudit(core.register(caller), "caller registration");
  assertAudit(core.register(target), "target registration");

  const tests = [];
  function record(name, result, expectation) {
    const ok = expectation(result);
    tests.push({ name, pass: ok, status: result.status });
    assertAudit(ok, name);
  }
  record("registered UserAPI request/response",
    await core.request("Audit.Caller", "Audit.Target", "echo",
      { token: 17 }, { origin: "user" }),
    r => r.ok && r.status === 200 && r.value.token === 17);
  record("AgentAPI denied",
    await core.request("Audit.Caller", "Audit.Target", "echo",
      {}, { origin: "agent" }),
    r => !r.ok && r.status === 403);
  record("Private endpoint denied",
    await core.request("Audit.Caller", "Audit.Target", "secret"),
    r => !r.ok && r.status === 403);
  record("unknown target denied",
    await core.request("Audit.Caller", "Unknown", "echo"),
    r => !r.ok && r.status === 404);
  record("unknown sender denied",
    await core.request("Unknown", "Audit.Target", "echo"),
    r => !r.ok && r.status === 404);
  record("invalid strict OCDA contract", {
    ok: core.register({
      id: "Audit.Invalid", parentPath: "Audit", strictOCDA: true,
      receive: async () => null
    }),
    status: 400
  }, r => !r.ok && r.status === 400);
  record("duplicate Object ID", {
    ok: core.register({ ...target }),
    status: 409
  }, r => !r.ok && r.status === 409);
  assertAudit(core.register({
    id: "Audit.Left", parentPath: "Audit", strictOCDA: true,
    ocda: contract(["loop"]),
    authorization: { default: "Public" },
    receive: async () => core.request("Audit.Left", "Audit.Right", "loop")
  }), "left registration");
  assertAudit(core.register({
    id: "Audit.Right", parentPath: "Audit", strictOCDA: true,
    ocda: contract(["loop"]),
    authorization: { default: "Public" },
    receive: async () => core.request("Audit.Right", "Audit.Left", "loop")
  }), "right registration");
  record("circular REQ wait rejected",
    await core.request("Audit.Caller", "Audit.Left", "loop"),
    r => r.ok && r.value?.ok &&
      r.value.value?.status === 423);
  const snapshot = core.getSnapshot();
  assertAudit(snapshot.logs.some(item =>
    item.kind === "Log" && item.action === "Request.echo" &&
    item.status === 200), "request log");
  assertAudit(snapshot.logs.some(item =>
    item.kind === "Log" && item.action === "Response.echo" &&
    item.status === 200), "response log");
  for (const status of [400, 403, 404, 409, 423]) {
    assertAudit(snapshot.logs.some(item =>
      item.kind === "EHU" && item.status === status),
    "failure EHU preservation " + status);
  }
  assertAudit(snapshot.dependencies.some(item =>
    item.link === "Audit.Caller->Audit.Target" && item.code === "10"),
  "REQ dependency");
  assertAudit(snapshot.dependencies.some(item =>
    item.link === "Audit.Target->Audit.Caller" && item.code === "01"),
  "REP dependency");

  const sandbox = new VirtualTestEnvironment();
  assertAudit(sandbox.create("Source").ok, "VTE.Source");
  assertAudit(sandbox.create("Target").ok, "VTE.Target");
  const response = await sandbox.act("Source", "Target", "echo", {
    evidence: "in-memory"
  });
  assertAudit(response.ok && response.value.evidence === "in-memory",
    "VTE response");
  assertAudit(!core.getSnapshot().objects.includes("VTE.Source"),
    "VTE must not mutate inspected LinkCore");

  return {
    schemaVersion: 1,
    subject: "real LinkCore and detached VTE runtime",
    tests,
    dependencies: snapshot.dependencies,
    logCounts: {
      log: snapshot.logs.filter(item => item.kind === "Log").length,
      ehu: snapshot.logs.filter(item => item.kind === "EHU").length
    },
    pass: tests.every(test => test.pass),
    limitations: [
      "Does not test browser permission prompts or actual file writes.",
      "Does not prove 1 GiB or 5 GiB throughput or crash survival.",
      "Dependency codes represent observed edges, not permissions."
    ]
  };
}
if (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runRuntimeAudit();
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
