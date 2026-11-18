import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PluginLocalAgentObject } from
  "../object/PluginLocalAgentObject.js";

const pluginDir = new URL("../plugins/ai-agent-mcp/", import.meta.url);

test("PR22.2 agent feed forwards only tool metadata", async () => {
  const events = [];
  const sent = [];
  const audits = [];
  const core = {
    omu: { record: (...values) => audits.push(values) },
    request: async () => ({ ok: true, value: { roots: ["Project"] } })
  };
  const agent = new PluginLocalAgentObject(core, "agent",
    { defaultView: {} });
  agent.state = "connected";
  agent.socket = { send: value => sent.push(JSON.parse(value)) };
  agent.explorerId = "PluginExplorer.agent";
  agent.mcpReadId = "PluginMCPRead.agent";
  agent.onActivity = event => events.push(event);

  await agent.dispatchShellTool({
    requestId: "activity-1",
    name: "cluster.list_roots",
    args: { marker: "private-sample" }
  });
  assert.equal(sent.at(-1).type, "tool_result");
  assert.equal(events[0].phase, "requested");
  assert.equal(events[1].phase, "accepted");
  assert.equal(events[0].tool, "cluster.list_roots");
  assert.equal(JSON.stringify(events).includes("secret"), false);
  assert.ok(audits.some(row => row[3] === 200));
});

test("PR22.2 permission rejection is recorded as denied", async () => {
  const events = [];
  const replies = [];
  const agent = new PluginLocalAgentObject({
    omu: { record: () => {} },
    request: async () => ({ ok: false, status: 403 })
  }, "agent", { defaultView: {} });
  agent.state = "connected";
  agent.socket = { send: value => replies.push(JSON.parse(value)) };
  agent.explorerId = "PluginExplorer.agent";
  agent.mcpReadId = "PluginMCPRead.agent";
  agent.onActivity = event => events.push(event);
  await agent.dispatchShellTool({
    requestId: "activity-2", name: "cluster.list_roots", args: {}
  });
  assert.equal(events.at(-1).phase, "denied");
  assert.equal(events.at(-1).status, 403);
  assert.equal(replies.at(-1).result.error, "Access denied");
});

test("PR22.2 agent markup receives sanitized activity and shell result", () => {
  const markup = readFileSync(
    new URL("index.html", pluginDir), "utf8");
  assert.match(markup, /cluster-agent-activity/);
  assert.match(markup, /cluster-agent-shell-result/);
  assert.match(markup, /result\.stderr/);
  assert.match(markup, /result\.stdout/);
});

test("PR22.2 native gateway maps denied browser tools to 403", () => {
  const gateway = readFileSync(
    new URL("local-agent\/server.cjs", pluginDir), "utf8");
  assert.match(gateway, /PowerShell authorization denied/);
  assert.match(gateway, /m\.result\?\.error/);
});
