import test from "node:test";
import assert from "node:assert/strict";
import { createTemplateZip, pluginTemplateFiles } from
  "../main/plugin-template-download.js";
import { PluginPackageManifestPolicy } from
  "../property/PluginPackageManifestPolicy.js";
import { PluginFolderPackagePolicy } from
  "../property/PluginFolderPackagePolicy.js";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";

function readStoredZip(bytes) {
  const entries = new Map();
  const view = new DataView(bytes.buffer, bytes.byteOffset,
    bytes.byteLength);
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const compression = view.getUint16(offset + 8, true);
    assert.equal(compression, 0);
    const size = view.getUint32(offset + 18, true);
    const length = view.getUint16(offset + 26, true);
    const extra = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 30, offset + 30 + length));
    const start = offset + 30 + length + extra;
    entries.set(name, new TextDecoder().decode(
      bytes.subarray(start, start + size)));
    offset = start + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  return entries;
}

test("PR13 template is a real bilingual multi-file ZIP", () => {
  for (const locale of ["zh-Hant", "en"]) {
    const files = pluginTemplateFiles(locale);
    const extracted = readStoredZip(createTemplateZip(files));
    assert.deepEqual([...extracted.keys()], Object.keys(files));
    assert.ok(extracted.has("src/worker.js"));
    assert.ok(extracted.has("src/ui.js"));
    assert.ok(extracted.has("styles/main.css"));
    assert.ok(extracted.has("index.html"));
    assert.match(extracted.get("README.md"), /API/);
    const parsed = PluginPackageManifestPolicy.validate(
      extracted.get("plugin.json"));
    assert.equal(parsed.status, 200);
    assert.equal(parsed.value.uiEntry, "index.html");
    assert.equal(parsed.value.provider.execution.isolation, "worker");
    for (const key of extracted.keys()) {
      assert.equal(PluginFolderPackagePolicy.validPath(key), true);
    }
  }
  assert.match(pluginTemplateFiles("en")["README.md"],
    /Request input and Response output/);
  assert.match(pluginTemplateFiles("zh-Hant")["README.md"],
    /API 列表/);
});

test("PR13 rejects unsafe template ZIP paths", () => {
  assert.throws(() => createTemplateZip({
    "../bad.js": "code"
  }), TypeError);
});

test("PR13 HubUnit has immutable symmetric Request/Response contracts",
  () => {
    const env = new VirtualTestEnvironment();
    const read = env.core.readProperty("VTE", "HubProtocolPolicy");
    assert.equal(read.status, 200);
    const contracts = read.value.descriptions;
    assert.ok(contracts.length >= 5);
    assert.deepEqual(contracts.map(item => item.action), [
      "request", "requestService", "readProperty",
      "discoverCatalog", "listProviderContracts"
    ]);
    for (const contract of contracts) {
      assert.equal(contract.inputSchema.type, "object");
      assert.equal(contract.outputSchema.properties.ok.type,
        "boolean");
      assert.equal(contract.outputSchema.properties.status.type,
        "integer");
    }
    assert.ok(Object.isFrozen(contracts));
    assert.ok(Object.isFrozen(contracts[0].inputSchema));
    assert.ok(env.log().some(entry =>
      entry.action === "Property.Read" && entry.status === 200));
  });
