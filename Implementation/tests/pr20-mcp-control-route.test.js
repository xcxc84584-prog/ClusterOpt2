import test from "node:test";
import assert from "node:assert/strict";
import { PluginLocalAgentObject } from
  "../object/PluginLocalAgentObject.js";
import { PluginExplorerObject } from
  "../object/PluginExplorerObject.js";

test("PR20 MCP file CRUD routes through Hub and selected root", async () => {
  const calls = [];
  const sent = [];
  const core = {
    omu: { record() {} },
    async request(source, target, action, payload) {
      calls.push({ source, target, action, payload });
      if (action === "status") {
        return { ok: true, status: 200,
          value: { selected: true, folderName: "Workspace" } };
      }
      return { ok: true, status: 200,
        value: { action, path: payload.path } };
    }
  };
  const agent = new PluginLocalAgentObject(
    core, "cluster.ai-agent-mcp",
    { defaultView: {} });
  agent.state = "connected";
  agent.socket = { send(data) { sent.push(JSON.parse(data)); } };
  agent.mcpReadId = "PluginMCPRead.cluster_ai_agent_mcp";
  agent.registerExplorer("PluginExplorer.cluster_ai_agent_mcp");

  await agent.dispatchShellTool({
    requestId: "r1", name: "cluster.create_file",
    args: { path: "Workspace/src", name: "hello.txt" }
  });
  assert.equal(calls.at(-1).action, "create");
  assert.equal(calls.at(-1).payload.path, "src/hello.txt");
  assert.equal(sent.at(-1).result.created, true);

  await agent.dispatchShellTool({
    requestId: "r2", name: "cluster.read_path",
    args: { path: "Workspace/src/hello.txt", offset: 4, length: 20 }
  });
  assert.equal(calls.at(-1).action, "readChunk");
  assert.equal(calls.at(-1).payload.offset, 4);

  await agent.dispatchShellTool({
    requestId: "r3", name: "cluster.delete_path",
    args: { path: "AnotherRoot/hello.txt" }
  });
  assert.equal(sent.at(-1).result.error,
    "Explorer root is not authorized");
  assert.notEqual(calls.at(-1).action, "delete");
});

test("PR20 Explorer rejects Agent without explicit trusted identity", async () => {
  const core = { omu: { record() {} } };
  const explorer = new PluginExplorerObject(
    core, "cluster.ai-agent-mcp");
  await assert.rejects(
    explorer.receive("list", { path: "" },
      { source: "PluginLocalAgent.fake" }),
    error => error.status === 403);
  explorer.authorizeAgent("PluginLocalAgent.allowed");
  await assert.rejects(
    explorer.receive("list", { path: "" },
      { source: "PluginLocalAgent.allowed" }),
    error => error.status === 403);
});

test("PR20 open PowerShell requires ToolBox PS right", async () => {
  const sent = [];
  let opened = 0;
  let psGranted = false;
  const core = {
    omu: { record() {} },
    async request(_source, _target, action) {
      assert.equal(action, "status");
      return { ok: true, status: 200, value: {
        selected: true, folderName: "Workspace",
        permissions: { ps: psGranted }
      } };
    }
  };
  const doc = {
    defaultView: {},
    getElementById(id) {
      assert.equal(id, "explorerPowerShell");
      return { click() { opened++; } };
    }
  };
  const agent = new PluginLocalAgentObject(
    core, "cluster.ai-agent-mcp", doc);
  agent.state = "connected";
  agent.socket = { send(data) { sent.push(JSON.parse(data)); } };
  agent.shellApprovalId = "PluginShell.cluster_ai_agent_mcp";
  agent.registerExplorer("PluginExplorer.cluster_ai_agent_mcp");

  await agent.dispatchShellTool({
    requestId: "ps1", name: "cluster.open_powershell", args: {}
  });
  assert.equal(opened, 0);
  assert.equal(sent.at(-1).result.error,
    "PowerShell permission not granted");

  psGranted = true;
  await agent.dispatchShellTool({
    requestId: "ps2", name: "cluster.open_powershell", args: {}
  });
  assert.equal(opened, 1);
  assert.equal(sent.at(-1).result.requested, true);

  agent.shellApprovalId = null;
  await agent.dispatchShellTool({
    requestId: "ps3", name: "cluster.open_powershell", args: {}
  });
  assert.equal(opened, 1);
  assert.equal(sent.at(-1).result.error, "Tool access denied");
});

test("PR20 path lookup requires read grant and user confirmation", async () => {
  const replies = [];
  let readAllowed = false;
  let prompts = 0;
  const core = {
    omu: { record() {} },
    async request(_source, _target, action) {
      assert.equal(action, "status");
      return { ok: true, status: 200, value: {
        selected: true, folderName: "Workspace",
        permissions: { read: readAllowed }
      } };
    }
  };
  const doc = {
    defaultView: {
      prompt() { prompts++; return "mock-user-confirmed-path"; }
    }
  };
  const agent = new PluginLocalAgentObject(
    core, "cluster.ai-agent-mcp", doc);
  agent.state = "connected";
  agent.socket = { send(data) { replies.push(JSON.parse(data)); } };
  agent.mcpReadId = "PluginMCPRead.cluster_ai_agent_mcp";
  agent.registerExplorer("PluginExplorer.cluster_ai_agent_mcp");
  const query = {
    name: "cluster.find_root_windows_path",
    args: { root: "Workspace", candidates: [] }
  };
  await agent.dispatchShellTool({ ...query, requestId: "q1" });
  assert.equal(prompts, 0);
  assert.ok(replies.at(-1).result.error);
  readAllowed = true;
  await agent.dispatchShellTool({ ...query, requestId: "q2" });
  assert.equal(prompts, 1);
  assert.equal(replies.at(-1).result.confirmedByUser, true);
  assert.equal(replies.at(-1).result.verified, false);
});
