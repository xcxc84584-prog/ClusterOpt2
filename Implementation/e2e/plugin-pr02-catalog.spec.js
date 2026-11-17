import { test, expect } from "@playwright/test";

test("PR02.04 live internal catalog works in actual browser", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { LinkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const core = new LinkCore();
    const object = {
      id: "Example.Highlight", strictOCDA: true,
      receive: async (_action, payload) => payload,
      ocda: {
        Request: ["highlight"], Response: ["highlight"],
        UserAPI: ["highlight"], AgentAPI: [], Property: [],
        Program: "Test", EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
        APIDescriptors: [{
          apiVersion: 1, id: "editor.highlight",
          owner: "Example.Highlight", action: "highlight",
          version: "1.0.0", visibility: "Public", sideEffect: "none",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" }
        }]
      }
    };
    const empty = core.catalog.collect().value.apis.length === 0;
    const registered = core.register(object);
    const snapshot = core.catalog.collect();
    const called = await core.request("Example.Highlight",
      "Example.Highlight", "highlight", { ok: true });
    core.unregister(object.id);
    return {
      empty, registered,
      count: snapshot.value.apis.length,
      frozen: Object.isFrozen(snapshot.value.apis[0]),
      removed: core.catalog.collect().value.apis.length === 0,
      requestStatus: called.status,
      legacy: typeof window.Cluster?.log === "function"
    };
  });
  expect(result).toEqual({
    empty: true, registered: true, count: 1, frozen: true,
    removed: true, requestStatus: 200, legacy: true
  });
});
