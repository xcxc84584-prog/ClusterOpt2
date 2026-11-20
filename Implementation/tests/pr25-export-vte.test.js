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
