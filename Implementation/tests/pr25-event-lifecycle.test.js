import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { auditStaticSources } from "../../scripts/verify-api-catalog.mjs";

test("PR25 Event catalog reflects authoritative Worker SDK contract",
  () => {
    const core = new LinkCore();
    core.register({ id: "ui", receive: async () => null });
    const listed = core.discover("ui","page","event",{
      term: "WorkerSDK.SessionChange"
    });
    assert.equal(listed.status, 200);
    assert.equal(listed.value.total, 1);
    const detail = core.discover("ui","describeLive","event",{
      id: "WorkerSDK.SessionChange", owner: "PluginWorker"
    });
    assert.equal(detail.status, 200);
    assert.deepEqual(
      [...detail.value.descriptor.payloadSchema.enum],
      ["ready","suspended"]);
    assert.equal(detail.value.descriptor.subscribe,
      "Cluster.onSessionChange(listener)");
  });

test("PR25 EDPMU Event source audit emits located EHU on mismatch", () => {
  const core = new LinkCore();
  const audited = auditStaticSources(core);
  assert.equal(audited.ok,true,JSON.stringify(audited.failures));
  assert.ok(audited.checked >= 5);
  const failed = auditStaticSources(core,process.cwd(),path =>
    path.endsWith("PluginWorkerSource.js") ? "" :
      path.endsWith("PluginLifecycleEventPolicy.js") ?
        (Array.from({length: 30}, (_,index) => index === 11 ?
          '      version: "1.0.0",' : "").join("\n")) :
        "invalid source");
  assert.equal(failed.status,409);
  assert.ok(failed.failures.some(issue =>
    issue.code === "CATALOG_EVENT_TRIGGER_MISMATCH" &&
    issue.file === "Implementation/property/PluginLifecycleEventPolicy.js" &&
    issue.line === 12));
  assert.ok(core.omu.snapshot().logs.some(event =>
    event.kind === "EHU" &&
    event.details?.code === "CATALOG_EVENT_TRIGGER_MISMATCH"));
});
