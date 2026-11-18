import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = name => readFileSync(new URL(name, root), "utf8");

test("PR21 inline host port/token fields use 1:3 grid", () => {
  const html = read("plugins/ai-agent-mcp/index.html");
  const host = read("LinkCore/PluginUIHostUnit.js");
  assert.ok(html.includes('id="caiTrustedPairSlot"'));
  assert.doesNotMatch(html, /caiTokenPreview|Host-managed pairing token/);
  assert.ok(host.includes("grid-template-columns:minmax(0,1fr)"));
  assert.ok(host.includes('"minmax(0,3fr);gap:10px;min-width:0;"'));
  assert.ok(host.includes('portField.input.value = String(agent.pairPort)'));
  assert.ok(host.includes('portField.input.min = "1024"'));
  assert.ok(host.includes('portField.input.max = "65535"'));
  assert.ok(host.includes('tokenField.input.pattern = "[a-fA-F0-9]{64}"'));
});

test("PR21 credentials remain trusted-host-only, single-use", () => {
  const html = read("plugins/ai-agent-mcp/index.html");
  const host = read("LinkCore/PluginUIHostUnit.js");
  const agent = read("object/PluginLocalAgentObject.js");
  assert.ok(html.includes("cluster-plugin-pair-layout"));
  assert.doesNotMatch(html, /data-agent-action="pair"/);
  assert.ok(host.includes("agent.stageHostPairing(port, token)"));
  assert.ok(host.includes('"pair", {}, { origin: "user" }'));
  assert.ok(host.includes('tokenField.input.value = ""'));
  assert.ok(host.includes("agent.discardHostPairing()"));
  assert.ok(agent.includes("this.pendingHostPairing = null"));
  assert.ok(agent.includes("return Promise.resolve(credentials)"));
  assert.doesNotMatch(host, /"pair", \{\s*token/);
});

test("PR21 port CPO refuses changed PIDs without aborting setup", () => {
  const script = read("local-agent/install-current.ps1");
  assert.ok(script.includes("Port owner changed; override aborted"));
  assert.ok(script.includes("Override refused: "));
  assert.ok(script.includes("Choose P for a free port, C to cancel"));
  assert.ok(script.includes("Release-OccupiedPort -Port $port"));
});

test("PR21 MCP setup logs each actual failed download", () => {
  const cmd = read(
    "plugins/ai-agent-mcp/local-agent/MCP-Quick-Setup.cmd");
  assert.ok(cmd.includes('call :download "%%F"'));
  assert.ok(cmd.includes("Failed asset: %ASSET%"));
  assert.ok(cmd.includes("DOWNLOAD FAILED: "));
  assert.ok(cmd.includes("exit /b 1"));
});
