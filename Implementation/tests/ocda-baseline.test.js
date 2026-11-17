import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBaseline, markdownReport } from "../tools/ocda-baseline.mjs";

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "ocda-inventory-"));
  try {
    await mkdir(join(root, "Implementation", "object"), { recursive: true });
    await mkdir(join(root, "Implementation", "property"), { recursive: true });
    await writeFile(join(root, "Implementation", "object", "A.js"),
      `import { P } from "../property/P.js";
       export class A {
         constructor() {
           this.id = "sample";
           this.ocda = { Request: ["load"], Response: ["load"],
             UserAPI: ["load"], AgentAPI: [], Property: ["P"] };
         }
         run(core) {
           core.readProperty("sample", "P");
           return core.request("sample", "disk", "load");
         }
       }`);
    await writeFile(join(root, "Implementation", "property", "P.js"),
      "export const P = Object.freeze({});");
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("source inventory extracts contracts, imports and requests", async () => {
  await fixture(async root => {
    const report = await buildBaseline(root);
    assert.equal(report.summary.files, 2);
    assert.equal(report.summary.missingImports, 0);
    const node = report.nodes.find(item => item.objectIds.includes("sample"));
    assert.ok(node);
    assert.deepEqual(node.actions.Request, ["load"]);
    assert.deepEqual(node.propertyReads, ["P"]);
    assert.deepEqual(node.requests, [{ target: "disk", action: "load" }]);
    assert.ok(report.edges.some(edge => edge.type === "import"));
    assert.match(markdownReport(report), /Open gates/);
  });
});
test("missing imports are reported but not executed", async () => {
  await fixture(async root => {
    await writeFile(join(root, "Implementation", "object", "Bad.js"),
      'import "../property/Absent.js";');
    const report = await buildBaseline(root);
    assert.equal(report.summary.missingImports, 1);
  });
});
