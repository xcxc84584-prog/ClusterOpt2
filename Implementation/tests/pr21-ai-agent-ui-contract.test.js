import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ReleaseVersion } from "../property/ReleaseVersion.js";
import { setupFilename } from "../main/legacy-powershell/cmd-setup.js";

const plugin = new URL("../plugins/ai-agent-mcp/", import.meta.url);
const host = new URL("../LinkCore/PluginUIHostUnit.js", import.meta.url);
const nativeSetup = new URL("../local-agent/install-current.ps1",
  import.meta.url);
const read = path => readFileSync(new URL(path, plugin), "utf8");

test("PR21 release 0.0.15b is one centralized version authority", () => {
  assert.equal(ReleaseVersion.product, "0.0.15b");
  assert.ok(setupFilename(ReleaseVersion.product).endsWith(
    "0.0.15b.cmd"));
  const source = readFileSync(nativeSetup, "utf8");
  assert.ok(source.includes(
    "[ValidatePattern('^\\d+\\.\\d+\\.\\d+[a-z]?"));
  assert.doesNotMatch(source, /ValidatePattern\('\^\\d\+\\\.\\d\+\\\.\\d\+\(\?:-pr/);
});

test("PR21 legacy bar contains no removed model UI or chat input", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /data-model-action|<textarea|id="caiForm"/);
  const header = html.slice(html.indexOf('class="cai-bar"'),
    html.indexOf('id="caiSetup"'));
  const actions = [
    "data-toolbox-toggle", "data-legacy-guide",
    'data-agent-action="ping"', 'data-agent-action="disconnect"'
  ];
  let cursor = -1;
  for (const item of actions) {
    const next = header.indexOf(item);
    assert.ok(next > cursor, "Incorrect toolbar order: " + item);
    cursor = next;
  }
  assert.ok(html.includes("cluster-plugin-download-package"));
  assert.ok(html.includes("data-package-download"));
  assert.doesNotMatch(html, /id="caiConnectGuide"/);
  assert.ok(html.includes("data-saved-connect"));
  assert.ok(html.includes("cluster-local-agent-use-saved"));
});

test("PR21 trusted host owns ToolBox and full ZIP download", () => {
  const code = readFileSync(host, "utf8");
  assert.ok(code.includes("cluster-plugin-toolbox-toggle"));
  assert.ok(code.includes("cluster-plugin-toolbox-state"));
  assert.ok(code.includes("cluster-plugin-download-package"));
  assert.ok(code.includes("downloadAgentPackage"));
  assert.ok(code.includes("view.closeToolBox"));
  assert.ok(code.includes("view.disposeToolBox"));
  const zh = JSON.parse(read("locales/zh-Hant.json"));
  const en = JSON.parse(read("locales/en.json"));
  for (const labels of [zh, en]) {
    assert.ok(labels.toolbox);
    assert.ok(labels.guideStep1);
    assert.ok(labels.guideStep8);
    assert.ok(labels.downloadPackage);
    assert.equal(labels.settings, undefined);
    assert.equal(labels.modelStatus, undefined);
  }
});
