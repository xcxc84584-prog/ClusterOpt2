import {ReleaseVersion} from "../property/ReleaseVersion.js";
import { test, expect } from "@playwright/test";

test("PR02.10 Cluster.api works in real page without changing legacy API",
  async ({ page }) => {
    await page.goto("/");
    const state = await page.evaluate(async () => {
      const api = window.Cluster.api;
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const owner = "CatalogFacadeBrowser";
      linkCore.register({
        id: owner, strictOCDA: true,
        authorization: { default: "Public" },
        receive: async () => { throw Error("Must not execute"); },
        ocda: {
          Request: ["run"], Response: ["run"],
          UserAPI: ["run"], AgentAPI: [], Property: [],
          Program: "Facade E2E", EHU: "LinkCore.OMU",
          Log: "LinkCore.OMU",
          APIDescriptors: [{
            apiVersion: 1, id: "facade.browser.run",
            owner, action: "run", version: "1.0.0",
            visibility: "Public", sideEffect: "none",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" }
          }]
        }
      });
      const list = api.list("api");
      const describe = api.describe("api", "facade.browser.run", owner);
      const query = api.query("api", { term: "facade.browser" });
      const docs = api.docs("json");
      const denied = api.list("api", { limit: 101 });
      return {
        keys: Object.keys(api).sort(),
        frozen: Object.isFrozen(api),
        methods: ["version", "log", "rep", "objectlist",
          "propertylist", "subobject", "inheritedProperties"]
          .every(key => typeof window.Cluster[key] === "function"),
        version: window.Cluster.version(),
        statuses: [list.status, describe.status, query.status,
          docs.status, denied.status],
        owner: describe.value?.descriptor?.owner,
        found: query.value?.total,
        docHasApi: JSON.stringify(docs).includes("facade.browser.run"),
        hasRequest: typeof api.request,
        hasRegister: typeof api.register,
        ehus: window.Cluster.log().filter(x =>
          x.kind === "EHU" && x.status === 400).length
      };
    });
    expect(state.keys).toEqual(["describe", "docs", "list", "query"]);
    expect(state.frozen).toBe(true);
    expect(state.methods).toBe(true);
    expect(state.version).toBe(ReleaseVersion.product);
    expect(state.statuses).toEqual([200, 200, 200, 200, 400]);
    expect(state.owner).toBe("CatalogFacadeBrowser");
    expect(state.found).toBe(1);
    expect(state.docHasApi).toBe(true);
    expect(state.hasRequest).toBe("undefined");
    expect(state.hasRegister).toBe("undefined");
    expect(state.ehus).toBeGreaterThan(0);
  });
