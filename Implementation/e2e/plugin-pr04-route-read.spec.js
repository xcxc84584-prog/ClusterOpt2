import { test, expect } from "@playwright/test";

test("PR04.09 read-only browser Route facade and no route takeover",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const { createRouteReadFacade } = await import(
        "/Implementation/LinkCore/RouteReadFacade.js");
      const core = new LinkCore();
      core.register({ id: "ui", receive: async () => null });
      const route = createRouteReadFacade(core);
      return {
        pageKeys: Object.keys(window.Cluster.routes).sort(),
        frozen: Object.isFrozen(window.Cluster.routes),
        list: route.list().status,
        preview: route.preview("test.routes", "run").status,
        mutation: typeof window.Cluster.routes.configure,
        legacy: typeof window.Cluster.api.list,
        version: window.Cluster.version()
      };
    });
    expect(result).toEqual({
      pageKeys: ["describe", "list", "preview"],
      frozen: true, list: 200, preview: 404,
      mutation: "undefined", legacy: "function",
      version: "0.0.10"
    });
  });
});
