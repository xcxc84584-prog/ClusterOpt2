import test from "node:test";
import assert from "node:assert/strict";
import { LiveCatalogExport } from "../LinkCore/LiveCatalogExport.js";
import { UnifiedRegistrationUnit } from
  "../LinkCore/UnifiedRegistrationUnit.js";
import { EntireDomainPropertyManagementUnit } from
  "../LinkCore/EntireDomainPropertyManagementUnit.js";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";

test("PR25 export includes all authorized contracts and SHA-256", async () => {
  const edpmu = new EntireDomainPropertyManagementUnit();
  const uru = new UnifiedRegistrationUnit(edpmu);
  const omu = new ObjectManagementUnit();
  uru.objects.set("ui", { ocda: { UserAPI: [] } });
  for (let i = 0; i < 107; i++) {
    const owner = "Plugin.P" + i;
    uru.objects.set(owner, { ocda: {
      UserAPI: ["run"], APIDescriptors: [{
        id: "item.read", owner, action: "run",
        version: "1.0.0", visibility: "Public",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }]
    } });
  }
  uru.objects.get("Plugin.P1").authorization = {
    run: "Private"
  };
  const result = await new LiveCatalogExport(uru, edpmu, omu)
    .export("ui");
  assert.equal(result.status, 200);
  assert.equal(result.value.counts.api, 106);
  assert.match(result.value.sha256, /^[0-9a-f]{64}$/);
  const data = JSON.parse(result.value.json);
  assert.equal(data.contracts.api.length, 106);
  assert.equal(result.value.json.includes("Plugin.P1\",\"descriptor"),
    false);
});

test("PR25 complete export includes protocol and declared lifecycle Event",
  async () => {
    const { LinkCore } = await import("../LinkCore/LinkCore.js");
    const core = new LinkCore();
    core.register({ id: "ui", receive: async () => null });
    const exported = await core.exportLiveCatalog("ui");
    assert.equal(exported.status, 200,
      JSON.stringify(exported.error));
    const data = JSON.parse(exported.value.json);
    assert.ok(data.counts.protocol >= 6);
    assert.equal(data.counts.event, 2);
    const lifecycle = data.contracts.event.find(x =>
      x.id === "WorkerSDK.SessionChange").descriptor;
    assert.deepEqual(lifecycle.payloadSchema.enum,
      ["ready", "suspended"]);
    assert.equal(Object.keys(data.counts).length, 5);
  });

test("PR25 export fails closed when caller scope changes mid-export",
  async () => {
    const edpmu = new EntireDomainPropertyManagementUnit();
    const uru = new UnifiedRegistrationUnit(edpmu);
    const omu = new ObjectManagementUnit();
    uru.objects.set("ui", { ocda: { UserAPI: [] } });
    const owner = "Plugin.Revoked";
    uru.objects.set(owner, { ocda: {
      UserAPI: ["read"],
      APIDescriptors: [{
        id: "item.read", owner, action: "read",
        version: "1.0.0", visibility: "Public",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      }]
    } });
    const exporter = new LiveCatalogExport(uru, edpmu, omu);
    const page = exporter.page.page.bind(exporter.page);
    let changed = false;
    exporter.page.page = (...args) => {
      const result = page(...args);
      if (!changed && args[1] === "api" && result.ok) {
        changed = true;
        uru.objects.get(owner).authorization = { read: "Private" };
      }
      return result;
    };
    const result = await exporter.export("ui");
    assert.equal(result.status, 409);
    assert.ok(omu.snapshot().logs.some(event =>
      event.kind === "EHU" &&
      event.action === "Catalog.ExportConsistency"));
  });
