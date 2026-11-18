import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../plugins/ai-agent-mcp/local-agent/", import.meta.url);
const property = new URL("../property/PluginLocalAgentPolicy.js", import.meta.url);
const agent = new URL("../object/PluginLocalAgentObject.js", import.meta.url);

function read(name) {
  return readFileSync(new URL(name, root), "utf8");
}

test("PR20.2 standardized default ports across launchers and runtimes", () => {
  const helper = read("Port-CPO.ps1");
  assert.match(helper, /terminal = 43881; mcp = 43880; oauth = 43879/);
  assert.match(readFileSync(property, "utf8"),
    /ws:\/\/127\.0\.0\.1:43881\/agent/);
  assert.match(readFileSync(agent, "utf8"), /this\.pairPort = 43881;/);
  assert.match(read("server.cjs"), /CLUSTER_TERMINAL_PORT\|\|43881/);
  assert.match(read("remote-mcp.cjs"), /CLUSTER_MCP_PORT\|\|43880/);
  assert.match(read("remote-mcp.cjs"), /CLUSTER_TERMINAL_PORT\|\|43881/);
  assert.match(read("oauth-mcp-gateway.cjs"), /CLUSTER_OAUTH_PORT\|\|43879/);
  assert.match(read("oauth-mcp-gateway.cjs"), /CLUSTER_MCP_PORT\|\|43880/);
  assert.match(read("mcp-stdio.cjs"), /configuredPort=43881/);
});

test("PR20.2 all three launchers use shared CPO with service mapping", () => {
  for (const [name, service, portKey] of [
    ["Start-LocalAgent.ps1", "terminal", "CLUSTER_TERMINAL_PORT"],
    ["Start-MCP.ps1", "mcp", "CLUSTER_MCP_PORT"],
    ["Start-OAuth.ps1", "oauth", "CLUSTER_OAUTH_PORT"]
  ]) {
    const source = read(name);
    assert.match(source, /Port-CPO\.ps1/);
    assert.ok(source.includes("Select-ServicePort '" + service + "'"));
    assert.ok(source.includes("$env:" + portKey));
  }
  const boot = read("Setup-Quick.ps1");
  const background = read("Background-Agent.ps1");
  assert.match(boot, /Background-Agent\.ps1/);
  assert.match(background, /Select-ServicePort 'terminal'/);
  assert.match(background, /Port-CPO\.ps1/);
  const cmd = read("MCP-Quick-Setup.cmd");
  const gateway = read("Background-Gateway.ps1");
  const installer = read("Setup-MCP.ps1");
  assert.match(cmd, /Setup-MCP\.ps1/);
  assert.match(installer, /Port-CPO\.ps1/);
  assert.match(gateway, /Select-ServicePort 'oauth'/);
  assert.match(gateway, /127\.0\.0\.1:/);
  assert.match(read("Quick-Setup.cmd"), /port 43881 is used/);
});

test("PR20.2 override is always explicit and identity checked", () => {
  const policy = read("Port-CPO.ps1");
  assert.match(policy, /'\[C\]ancel \/ \[P\]ick port \/ \[O\]verride'/);
  assert.match(policy, /Type OVERRIDE to confirm/);
  assert.match(policy, /CreationDate -ne/);
  assert.match(policy, /ExecutablePath -ne/);
  assert.match(policy, /Parent process is protected/);
  assert.match(policy, /service-ports\.json/);
  assert.match(policy, /Cannot override another configured service/);
});
