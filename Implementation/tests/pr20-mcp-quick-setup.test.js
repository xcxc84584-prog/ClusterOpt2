import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../plugins/ai-agent-mcp/", import.meta.url);
const host = new URL("../", import.meta.url);

function asset(file) {
  return readFileSync(new URL(file, root), "utf8");
}

test("PR20 MCP standalone setup is explicit and loopback-only", () => {
  const cmd = asset("local-agent/MCP-Quick-Setup.cmd");
  assert.match(cmd, /^@echo off/);
  assert.match(cmd, /set "REV=[a-f0-9]{40}"/);
  assert.match(cmd, /choice \/M "Continue"/);
  const manager = asset("local-agent/Background-Gateway.ps1");
  assert.match(manager, /Select-ServicePort 'mcp'/);
  assert.match(manager, /Select-ServicePort 'oauth'/);
  assert.match(manager, /127\.0\.0\.1:/);
  assert.match(cmd, /Start-MCP\.ps1/);
  assert.match(cmd, /Start-OAuth\.ps1/);
  assert.match(asset("local-agent/remote-mcp.cjs"), /cluster\.read_file/);
  assert.doesNotMatch(cmd, /Stop-Process|taskkill|netsh interface/);
});

test("PR21.4 MCP installer uses pinned single-helper Cluster OneClick", () => {
  const cmd = asset("local-agent/MCP-Quick-Setup.cmd");
  const setup = asset("local-agent/Setup-MCP.ps1");
  assert.match(cmd, /REV=[a-f0-9]{40}/);
  assert.match(cmd, /Setup-MCP\.ps1/);
  assert.match(cmd, /Invoke-WebRequest/);
  assert.doesNotMatch(cmd, /call :download/);
  assert.match(setup, /remote-mcp\.cjs/);
  assert.match(setup, /oauth-mcp-gateway\.cjs/);
  assert.match(setup, /Background-Gateway\.ps1/);
  assert.match(setup, /-Action StartMCP/);
  assert.match(setup, /-Action StartOAuth/);
  assert.match(setup, /raw\.githubusercontent\.com/);
});

test("PR20 UI never submits chat, downloads through trusted host", () => {
  const html = asset("index.html");
  const hostCode = readFileSync(
    new URL("LinkCore/PluginUIHostUnit.js", host), "utf8");
  const downloads = readFileSync(
    new URL("main/plugin-agent-download.js", host), "utf8");
  assert.doesNotMatch(html, /<textarea|id="caiForm"|cluster-model-submit/);
  assert.match(html, /cluster-plugin-mcp-quick-setup/);
  assert.match(hostCode, /downloadMCPQuickSetup/);
  assert.match(downloads, /local-agent\/MCP-Quick-Setup\.cmd/);
});

test("PR20 bundled MCP retains all 14 legacy remote tool names", () => {
  const gateway = asset("local-agent/remote-mcp.cjs");
  const expected = [
    "get_status", "get_task_status", "list_files",
    "get_editor_state", "read_file", "list_roots",
    "find_root_windows_path", "list_directory", "read_path",
    "create_file", "write_path", "delete_path",
    "open_powershell", "powershell_request"
  ];
  // The legacy gateway includes 14 tools, with separate open and request.
  for (const action of expected) {
    assert.ok(gateway.includes("'cluster." + action + "'"),
      "Missing legacy MCP tool: " + action);
  }
  const oauth = asset("local-agent/oauth-mcp-gateway.cjs");
  const stdio = asset("local-agent/mcp-stdio.cjs");
  for (const action of expected) {
    assert.ok(stdio.includes("'cluster." + action + "'"),
      "Missing stdio MCP tool: " + action);
  }
  assert.ok(oauth.includes("cluster.control"));
  assert.ok(oauth.includes("scope:entry.scope"));
  assert.ok(oauth.includes("scopeNotice"));
  assert.ok(oauth.includes("readonlyTools.has(rpc.params.name)"));
  assert.ok(oauth.includes("session.scope==='cluster.control'"));
  assert.ok(oauth.includes("value.result.tools.filter"));
});
