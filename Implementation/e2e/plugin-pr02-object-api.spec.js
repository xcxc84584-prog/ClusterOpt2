import { test, expect } from "@playwright/test";

test("PR02.02 runtime Object descriptors follow real URU registration",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      const object = {
        id: "Demo.Highlighter", strictOCDA: true,
        receive: async (_action, payload) => payload,
        ocda: {
          Request: ["highlight"], Response: ["highlight"],
          UserAPI: ["highlight"], AgentAPI: [], Property: [],
          Program: "Demo", EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
          APIDescriptors: [{
            apiVersion: 1, id: "editor.highlight",
            owner: "Demo.Highlighter", action: "highlight",
            version: "1.0.0", visibility: "Public", sideEffect: "none",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" }
          }]
        }
      };
      core.register({ id: "ui", receive: async () => null });
      const registered = core.register(object);
      const described = core.uru.describeAPI(object.id);
      const response = await core.request("ui", object.id,
        "highlight", { text: "x" }, { origin: "user" });
      const removed = core.unregister(object.id);
      return {
        registered, described: described.status,
        frozen: Object.isFrozen(described.value),
        calls: response.status, removed,
        gone: core.uru.describeAPI(object.id).status
      };
    });
    expect(result).toEqual({
      registered: true, described: 200, frozen: true,
      calls: 200, removed: true, gone: 404
    });
  });
