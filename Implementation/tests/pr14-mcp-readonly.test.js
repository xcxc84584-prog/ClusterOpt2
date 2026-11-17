import test from "node:test";
import assert from "node:assert/strict";
import { VirtualTestEnvironment } from
  "../LinkCore/VirtualTestEnvironment.js";
import { PluginMCPReadOnlyObject } from
  "../object/PluginMCPReadOnlyObject.js";

function harness() {
  const env = new VirtualTestEnvironment();
  const agentId = "MockLocalAgent";
  const documentId = "doc-1";
  let status = "green";
  let bytes = "saved";
  const handle = {
    getFile: async () => ({
      size: bytes.length,
      text: async () => bytes
    })
  };
  const workspace = {
    id: "workspace", authorization: { default: "Public" },
    strictOCDA: true,
    ocda: {
      EHU: [], Log: [], Request: ["entries", "snapshot"],
      Response: ["entries", "snapshot"], UserAPI: [],
      AgentAPI: [], Property: [], Program: "MockWorkspace"
    },
    receive: action => action === "entries" ?
      [{ id: documentId, name: "saved.txt", status, handle }] :
      { activeId: documentId, documents: [{
        id: documentId, name: "saved.txt", status, handle,
        text: "do-not-send-snapshot-secret"
      }] }
  };
  assert.equal(env.core.register(workspace), true);
  assert.equal(env.core.register({
    id: agentId, receive: () => null
  }), true);
  const mcp = new PluginMCPReadOnlyObject(env.core,
    "cluster.ai-agent-mcp", agentId);
  assert.equal(env.core.register(mcp), true);
  // Capability checks remain a separate PluginPermission gate; this
  // fixture isolates the MCP Object and Hub EventChain tests.
  env.core.checkPluginPermission = () => true;
  const invoke = (name, args = {}, source = agentId) =>
    env.core.request(source, mcp.id, "call",
      { name, args });
  return {
    env, mcp, invoke,
    setStatus: value => { status = value; },
    setContent: value => { bytes = value; }
  };
}

test("PR14.8 MCP rejects absent opt-in and untrusted source", async () => {
  const h = harness();
  assert.equal((await h.invoke("cluster.list_files"))
    .value.error, "Denied");
  h.mcp.setEnabled(true);
  assert.equal((await h.invoke("cluster.list_files", {},
    "untrusted")).status, 403);
});

test("PR14.8 MCP exposes only bounded saved-file projections",
  async () => {
    const h = harness();
    h.mcp.setEnabled(true);
    const listed = await h.invoke("cluster.list_files");
    assert.equal(listed.status, 200);
    assert.equal(listed.value.files[0].saved, true);
    const state = await h.invoke("cluster.get_editor_state");
    assert.equal(state.value.activeId, "doc-1");
    assert.equal(JSON.stringify(state.value).includes(
      "do-not-send-snapshot-secret"), false);
    const read = await h.invoke("cluster.read_file", {
      id: "doc-1"
    });
    assert.equal(read.value.text, "saved");
    assert.equal(JSON.stringify(read.value).includes("handle"),
      false);
    h.setStatus("yellow");
    const refused = await h.invoke("cluster.read_file", {
      id: "doc-1"
    });
    assert.equal(refused.value.error,
      "File not available or unsaved");
    h.setStatus("green");
    h.setContent("x".repeat(65537));
    const oversized = await h.invoke("cluster.read_file", {
      id: "doc-1"
    });
    assert.equal(oversized.value.error,
      "File exceeds read limit");
  });

test("PR14.8 MCP unknown mutation tools fail closed", async () => {
  const h = harness();
  h.mcp.setEnabled(true);
  const response = await h.invoke("cluster.powershell_request", {
    command: "Get-Location", path: "Project"
  });
  assert.equal(response.value.error, "Tool not authorized");
  h.mcp.revoke();
  assert.equal((await h.invoke("cluster.list_files"))
    .value.error, "Denied");
});
