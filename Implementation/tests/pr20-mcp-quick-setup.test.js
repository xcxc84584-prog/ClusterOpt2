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
  assert.match(cmd, /127\.0\.0\.1:43880/);
  assert.match(cmd, /127\.0\.0\.1:43879/);
  assert.match(cmd, /Start-MCP\.ps1/);
  assert.match(cmd, /Start-OAuth\.ps1/);
  assert.match(cmd, /cluster\.read is READ ONLY/);
  assert.doesNotMatch(cmd, /Stop-Process|taskkill|netsh interface/);
});

test("PR20 MCP installer downloads pinned gateway assets with diagnostics", () => {
  const cmd = asset("local-agent/MCP-Quick-Setup.cmd");
  assert.ok(cmd.includes(
    "REV=9e9055421f6b0d6c021297b28deedbee964b526a"));
  assert.ok(cmd.includes("echo Fetching %ASSET%"));
  assert.ok(cmd.includes("DOWNLOAD FAILED:"));
  assert.ok(cmd.includes("call :download"));
  assert.ok(cmd.includes("Failed asset: %ASSET%"));
  assert.ok(cmd.includes("Port-CPO.ps1"));
  assert.ok(cmd.includes("SERVICE_NAME=clusteropt2"));
  assert.ok(cmd.includes("https://clusteropt2"));
  assert.ok(cmd.includes("raw.githubusercontent.com"));
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
