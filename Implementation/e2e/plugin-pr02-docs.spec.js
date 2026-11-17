import { test, expect } from "@playwright/test";

test("PR02.08 authorized JSON/Markdown documentation in real Chromium",
  async ({ page }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      core.register({ id: "reader", receive: async () => null });
      function add(visibility) {
        core.register({
          id: "Doc." + visibility, strictOCDA: true,
          authorization: { default: visibility },
          receive: async () => "hidden",
          ocda: {
            Request: ["run"], Response: ["run"],
            UserAPI: ["run"], AgentAPI: [], Property: [],
            Program: "Test", EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
            APIDescriptors: [{
              apiVersion: 1, id: "docs." + visibility.toLowerCase(),
              owner: "Doc." + visibility, action: "run",
              version: "1.0.0", visibility, sideEffect: "none",
              inputSchema: { type: "object" },
              outputSchema: { type: "object" }
            }]
          }
        });
      }
      add("Public");
      add("Private");
      const json = core.generateCatalogDocs("reader", "json");
      const md = core.generateCatalogDocs("reader", "markdown");
      return {
        jsonStatus: json.status,
        markdownStatus: md.status,
        count: JSON.parse(json.value.content).apis.length,
        hidden: !md.value.content.includes("docs.private"),
        unknown: core.generateCatalogDocs("ghost", "json").status,
        oldFacade: typeof window.Cluster?.log === "function",
        publicDocsFacade: typeof window.Cluster?.docs
      };
    });
    expect(outcome).toEqual({
      jsonStatus: 200, markdownStatus: 200,
      count: 1, hidden: true, unknown: 404,
      oldFacade: true, publicDocsFacade: "undefined"
    });
  });
