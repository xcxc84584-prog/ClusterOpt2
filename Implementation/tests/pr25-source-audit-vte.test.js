import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { auditStaticSources } from "../../scripts/verify-api-catalog.mjs";

test("PR25 build gate verifies real registered static source", () => {
  const core = new LinkCore();
  const result = auditStaticSources(core);
  assert.equal(result.ok, true, JSON.stringify(result.failures));
  assert.ok(result.checked >= 4);
});

test("PR25 source mismatch emits EHU with exact file and line", () => {
  const core = new LinkCore();
  const result = auditStaticSources(core, process.cwd(),
    () => "not the matching version");
  assert.equal(result.status, 409);
  assert.ok(result.failures.length >= 4);
  const issue = core.omu.snapshot().logs.find(x =>
    x.action === "Catalog.SourceAudit");
  assert.equal(issue.kind, "EHU");
  assert.equal(issue.details.code, "CATALOG_STATIC_VERSION_MISMATCH");
  assert.equal(issue.details.file, "Implementation/object/UICO.js");
  assert.equal(issue.details.line, 50);
});
