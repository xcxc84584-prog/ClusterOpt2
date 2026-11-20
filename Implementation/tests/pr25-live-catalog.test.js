import test from "node:test";
import assert from "node:assert/strict";
import { LiveCatalogPage } from "../LinkCore/LiveCatalogPage.js";
import { UnifiedRegistrationUnit } from
  "../LinkCore/UnifiedRegistrationUnit.js";
import { EntireDomainPropertyManagementUnit } from
  "../LinkCore/EntireDomainPropertyManagementUnit.js";
import { ObjectManagementUnit } from
  "../LinkCore/ObjectManagementUnit.js";

function fixture(count) {
  const edpmu = new EntireDomainPropertyManagementUnit();
  const uru = new UnifiedRegistrationUnit(edpmu);
  const omu = new ObjectManagementUnit();
  uru.objects.set("ui", { ocda: { UserAPI: [] } });
  for (let index = 0; index < count; index++) {
    const owner = "Plugin.P" + String(index).padStart(5, "0");
    uru.objects.set(owner, {
      ocda: {
        UserAPI: ["read"], AgentAPI: [],
        APIDescriptors: [{
          id: "item.read", owner, action: "read",
          version: "1.0.0", visibility: "Public",
          description: "Read a plugin item", permissions: ["item.read"],
          inputSchema: { type: "object" },
          outputSchema: { type: "object" }
        }]
      }
    });
  }
  return { uru, edpmu, omu,
    page: new LiveCatalogPage(uru, edpmu, omu) };
}

for (const count of [100, 1000, 10000]) {
  test("PR25 live catalog stable cursor at " + count + " items", () => {
    const { page } = fixture(count);
    const seen = new Set();
    let cursor = null;
    let revision = null;
    do {
      const result = page.page("ui", "api", { cursor, limit: 73 });
      assert.equal(result.status, 200);
      revision ??= result.value.snapshotRevision;
      assert.equal(result.value.snapshotRevision, revision);
      for (const item of result.value.items) {
        const key = item.owner + ":" + item.id;
        assert.equal(seen.has(key), false);
        assert.equal(item.inputSchema, undefined);
        seen.add(key);
      }
      cursor = result.value.nextCursor;
    } while (cursor);
    assert.equal(seen.size, count);
  });
}

test("PR25 changes invalidate prior cursor and emit located EHU", () => {
  const { page, uru, omu } = fixture(101);
  const first = page.page("ui", "api", { limit: 10 });
  const removed = first.value.items[0].owner;
  uru.objects.delete(removed);
  const stale = page.page("ui", "api", {
    limit: 10, cursor: first.value.nextCursor
  });
  assert.equal(stale.status, 409);
  const issue = omu.snapshot().logs.find(entry =>
    entry.action === "Catalog.RevisionMismatch");
  assert.equal(issue?.kind, "EHU");
  assert.equal(issue?.details?.code, "CATALOG_REVISION_MISMATCH");
});

test("PR25 search is source-filtered and descriptor bodies are lazy", () => {
  const { page, uru } = fixture(100);
  const target = uru.objects.get("Plugin.P00001");
  target.authorization = { read: "Private" };
  const filtered = page.page("ui", "api", {
    term: "Read a plugin item", limit: 100
  });
  assert.equal(filtered.value.total, 99);
  const hidden = page.describe("ui", "api", "item.read", "Plugin.P00001");
  assert.equal(hidden.status, 404);
  const visible = page.describe("ui", "api", "item.read", "Plugin.P00002");
  assert.equal(visible.value.descriptor.inputSchema.type, "object");
});

test("PR25 property pages return metadata, never live property values", () => {
  const { page, edpmu } = fixture(0);
  const descriptor = {
    apiVersion: 1, name: "PluginTheme", type: "string",
    owners: ["ui"], visibility: "Public",
    readable: true, writable: false
  };
  assert.equal(edpmu.register("PluginTheme", "sensitive", {
    owners: ["ui"], visibility: "Public", descriptor
  }).ok, true);
  const result = page.page("ui", "property");
  assert.equal(result.value.items[0].id, "PluginTheme");
  assert.equal(JSON.stringify(result).includes("sensitive"), false);
});
