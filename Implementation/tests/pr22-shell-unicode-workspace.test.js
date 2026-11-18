import test from "node:test";
import assert from "node:assert/strict";
import { PluginShellApprovalObject } from
  "../object/PluginShellApprovalObject.js";

function fixture(rootName = "作業1") {
  const events = [];
  const core = {
    omu: { record: (...event) => events.push(event) },
    checkPluginPermission: () => true
  };
  const explorer = {
    root: { kind: "directory", name: rootName },
    rights: { ps: true }
  };
  const shell = new PluginShellApprovalObject(
    core, "cluster.ai-agent-mcp", "PluginLocalAgent.cluster_ai_agent_mcp",
    explorer, {});
  shell.setEnabled(true);
  return { shell, explorer, events };
}

test("PR22 authorized Chinese workspace accepts exact scoped PS request",
  async () => {
    const { shell } = fixture();
    const result = await shell.receive("approve", {
      command: "Get-Location", path: "作業1"
    }, { source: shell.agentId });
    assert.deepEqual(result, { approved: true });
  });

test("PR22 PS still rejects mismatched or unsafe workspace names",
  async () => {
    for (const root of ["作業1", "開發專案"]) {
      const { shell } = fixture(root);
      for (const path of ["別的專案", "../作業1", "作業1/child",
        "作業1" + String.fromCharCode(92) + "child"]) {
        const response = await shell.receive("approve", {
          command: "Get-Location", path
        }, { source: shell.agentId });
        assert.equal(response.approved, false, path);
      }
      const approved = await shell.receive("approve", {
        command: "Get-Location", path: root
      }, { source: "unknown-agent" });
      assert.equal(approved.approved, false);
      shell.revoke();
      assert.equal((await shell.receive("approve", {
        command: "Get-Location", path: root
      }, { source: shell.agentId })).approved, false);
    }
  });
