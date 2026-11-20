import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

test("PR25 contract inspector audits authorized descriptors", () => {
  const core = new LinkCore();
  core.register({id:"ui",receive:async()=>null});
  const verified = core.inspectLiveContract("ui","api",
    "UICO.describe","UICO");
  assert.equal(verified.status,200);
  assert.equal(verified.code,"CATALOG_CONTRACT_VALID");
  assert.ok(core.omu.snapshot().logs.some(x =>
    x.action==="Catalog.ContractInspect" && x.status===200));
  const hidden=core.inspectLiveContract("unknown","api",
    "UICO.describe","UICO");
  assert.equal(hidden.status,404);
  assert.ok(core.omu.snapshot().logs.some(x =>
    x.kind==="EHU" && x.action==="Catalog.describeLive" &&
    x.status===404));
});
