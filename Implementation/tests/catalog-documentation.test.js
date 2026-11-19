import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";

function registerAPI(core, visibility, description = "Safe API") {
  const owner = "Doc." + visibility;
  assert.equal(core.register({
    id: owner, strictOCDA: true,
    authorization: { default: visibility },
    receive: async () => "should-not-run",
    ocda: {
      Request: ["run"], Response: ["run"],
      UserAPI: ["run"], AgentAPI: [], Property: [],
      Program: "Test", EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
      APIDescriptors: [{
        apiVersion: 1, id: "doc." + visibility.toLowerCase(),
        owner, action: "run", version: "1.0.0",
        visibility, sideEffect: "none",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        description
      }]
    }
  }), true);
}

test("PR02.08 documents only Hub-authorized APIs in JSON and Markdown", () => {
  const core = new LinkCore();
  core.register({ id: "reader", receive: async () => null });
  registerAPI(core, "Public");
  registerAPI(core, "Private");
  const json = core.generateCatalogDocs("reader", "json");
  const markdown = core.generateCatalogDocs("reader", "markdown");
  assert.equal(json.status, 200);
  assert.equal(markdown.status, 200);
  const parsed = JSON.parse(json.value.content);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.apis.length, 5);
  assert.equal(parsed.apis[0].descriptor.visibility, "Public");
  assert.equal(json.value.content.includes("doc.private"), false);
  assert.equal(markdown.value.content.includes("doc.private"), false);
  assert.ok(markdown.value.content.startsWith("# ClusterOpt2 API Catalog"));
  assert.ok(Object.isFrozen(json.value));
  assert.equal(core.generateCatalogDocs("reader", "json")
    .value.content, json.value.content, "Output must be deterministic");
  assert.equal(core.generateCatalogDocs("Doc.Private", "json").status, 200);
  assert.equal(JSON.parse(core.generateCatalogDocs("Doc.Private", "json")
    .value.content).apis.length, 6);
  assert.equal(typeof window, "undefined");
});

test("PR02.08 escapes Markdown injection from descriptions", () => {
  const core = new LinkCore();
  core.register({ id: "reader", receive: async () => null });
  registerAPI(core, "Public", "# malicious\n<script>alert(1)</script>");
  const markdown = core.generateCatalogDocs("reader", "markdown");
  assert.equal(markdown.status, 200);
  assert.equal(markdown.value.content.includes("<script>"), false);
  assert.equal(markdown.value.content.includes("\n<script>"), false);
  assert.ok(markdown.value.content.includes("&lt;script"));
  assert.equal(core.generateCatalogDocs("reader", "json").status, 200);
});

test("PR02.08 rejects unregistered callers and unsupported formats", () => {
  const core = new LinkCore();
  assert.equal(core.generateCatalogDocs("ghost", "json").status, 404);
  core.register({ id: "reader", receive: async () => null });
  assert.equal(core.generateCatalogDocs("reader", "xml").status, 400);
  assert.equal(core.generateCatalogDocs("reader", "markdown",
    { origin: "unknown" }).status, 400);
  assert.ok(core.getSnapshot().logs.some(log =>
    log.kind === "EHU" && log.status === 404));
});

test("PR02.08 refuses oversized serialized documents without truncating", () => {
  const core = new LinkCore();
  core.register({ id: "reader", receive: async () => null });
  // 80 independent, validated descriptions exceed the 64 KiB limit
  // when their schemas and metadata are serialized as JSON.
  for (let index = 0; index < 90; index++) {
    const owner = "Extra" + index;
    assert.equal(core.register({
      id: owner, strictOCDA: true,
      receive: async () => null,
      ocda: {
        Request: ["run"], Response: ["run"],
        UserAPI: ["run"], AgentAPI: [], Property: [],
        Program: "Test", EHU: "LinkCore.OMU",
        Log: "LinkCore.OMU",
        APIDescriptors: [{
          apiVersion: 1, id: "extra." + index,
          owner, action: "run", version: "1.0.0",
          visibility: "Public", sideEffect: "none",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          description: "x".repeat(800)
        }]
      }
    }), true);
  }
  assert.equal(core.generateCatalogDocs("reader", "json").status, 413);
});
