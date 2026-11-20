import test from "node:test";
import assert from "node:assert/strict";
import { CatalogStaticGuard } from "../LinkCore/CatalogStaticGuard.js";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";

test("PR25 static versions report owner, file, line and EHU", () => {
  const omu = new ObjectManagementUnit();
  const uru = { objects: new Map([["Plugin.A", {
    ocda: { APIDescriptors: [{
      id: "read", version: "2.0.0"
    }] }
  }]]) };
  const guard = new CatalogStaticGuard(uru, omu);
  assert.deepEqual(guard.verify([{
    owner: "Plugin.A", id: "read", version: "2.0.0",
    file: "Implementation/object/PluginA.js", line: 19
  }]), { ok: true, status: 200, checked: 1 });
  const stale = guard.verify([{
    owner: "Plugin.A", id: "read", version: "1.0.0",
    file: "Implementation/object/PluginA.js", line: 19
  }]);
  assert.equal(stale.status, 409);
  assert.equal(stale.failures[0].code, "CATALOG_VERSION_MISMATCH");
  assert.equal(stale.failures[0].file,
    "Implementation/object/PluginA.js");
  assert.equal(stale.failures[0].line, 19);
  const event = omu.snapshot().logs[0];
  assert.equal(event.kind, "EHU");
  assert.equal(event.details.code, "CATALOG_VERSION_MISMATCH");
  assert.equal(event.details.actualVersion, "2.0.0");
});

test("PR25 static checks reject missing source and invalid paths", () => {
  const omu = new ObjectManagementUnit();
  const guard = new CatalogStaticGuard({
    objects: new Map()
  }, omu);
  const result = guard.verify([{
    owner: "Plugin.A", id: "read", version: "1.0.0",
    file: "../secret.js", line: 3
  }]);
  assert.equal(result.status, 409);
  assert.equal(result.failures[0].code, "CATALOG_STATIC_INVALID");
  assert.equal(omu.snapshot().logs[0].kind, "EHU");
});
