import test from "node:test";
import assert from "node:assert/strict";
import { PluginShellApprovalObject } from
  "../object/PluginShellApprovalObject.js";
import { PluginLocalAgentPolicy as Policy } from
  "../property/PluginLocalAgentPolicy.js";

function fixture() {
  const logs = [];
  const explorer = {
    root: { name: "Project" },
    rights: { ps: false }
  };
  const doc = {
    defaultView: {
      confirm: () => true
    }
  };
  let grants = true;
  const core = {
    omu: {
      record: (...values) => logs.push(values)
    },
    checkPluginPermission: () => grants
  };
  const shell = new PluginShellApprovalObject(core,
    "cluster.ai-agent-mcp", "PluginLocalAgent.mock",
    explorer, doc);
  const invoke = (payload, source = "PluginLocalAgent.mock") =>
    shell.receive("approve", payload, { source });
  return {
    logs, shell, explorer, doc, invoke,
    revokeGrant: () => { grants = false; }
  };
}

test("PR14.7 PowerShell remains deny-by-default", async () => {
  const h = fixture();
  const rejected = await h.invoke({
    path: "Project", command: "Get-Location"
  });
  assert.equal(rejected.approved, false);
  assert.ok(h.logs.some(record => record[0] === "EHU" &&
    record[3] === 403));
});

test("PR14.7 only trusted local Agent gets exact approval", async () => {
  const h = fixture();
  h.shell.setEnabled(true);
  h.explorer.rights.ps = true;
  const payload = { path: "Project", command: "Get-Location" };
  assert.equal((await h.invoke(payload)).approved, true);
  assert.equal((await h.invoke(payload, "untrusted")).approved, false);
  assert.equal((await h.invoke({
    path: "Elsewhere", command: "Get-Location"
  })).approved, false);
  h.doc.defaultView.confirm = () => false;
  assert.equal((await h.invoke(payload)).approved, false);
  h.doc.defaultView.confirm = () => true;
  h.revokeGrant();
  assert.equal((await h.invoke(payload)).approved, false);
});

test("PR14.7 revoking shell prevents further approval", async () => {
  const h = fixture();
  h.shell.setEnabled(true);
  h.explorer.rights.ps = true;
  h.shell.revoke();
  assert.equal((await h.invoke({
    path: "Project", command: "Get-Location"
  })).approved, false);
});

test("PR14.7 tool bridge parser validates unsupported requests", () => {
  const valid = {
    type: "tool_call", requestId: crypto.randomUUID(),
    name: "cluster.powershell_request",
    args: { path: "Project", command: "Get-Location" }
  };
  assert.equal(Policy.inspectMessage(JSON.stringify(valid)).ok, true);
  assert.equal(Policy.inspectMessage(JSON.stringify({
    ...valid, requestId: "../bad"
  })).ok, false);
  assert.equal(Policy.inspectMessage(JSON.stringify({
    ...valid, args: null
  })).ok, false);
});
