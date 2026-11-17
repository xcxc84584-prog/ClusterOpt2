import { test, expect } from "@playwright/test";

test("PR02.09 real browser Hub boundary preserves negative EHU",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { VirtualTestEnvironment } = await import(
        "/Implementation/LinkCore/VirtualTestEnvironment.js");
      const env = new VirtualTestEnvironment();
      const core = env.core;
      core.register({ id: "reader", receive: async () => null });
      const invalid = core.discover("reader", "list", "api",
        { limit: 101 });
      const missing = core.discover("missing", "list", "api");
      const format = core.generateCatalogDocs("reader", "xml");
      const valid = core.discover("reader", "list", "api");
      return {
        codes: [invalid.status, missing.status, format.status,
          valid.status],
        failures: env.log().filter(event => event.kind === "EHU")
          .map(event => ({
            status: event.status, eventId: event.eventId,
            action: event.action
          })),
        legacy: typeof window.Cluster?.version === "function",
        facade: typeof window.Cluster?.api
      };
    });
    expect(result.codes).toEqual([400, 404, 400, 200]);
    expect(result.failures.map(x => x.status)).toEqual(
      expect.arrayContaining([400, 404]));
    expect(new Set(result.failures.map(x => x.eventId)).size)
      .toBe(result.failures.length);
    expect(result.legacy).toBe(true);
    expect(result.facade).toBe("undefined");
  });
