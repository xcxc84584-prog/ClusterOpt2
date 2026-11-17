import { test, expect } from "@playwright/test";

test("PR02.06 HubUnit discovery filters private metadata in Chromium",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      core.register({ id: "guest", receive: async () => null });
      const object = visibility => ({
        id: "Example." + visibility,
        strictOCDA: true,
        authorization: { default: visibility },
        receive: async () => "secret",
        ocda: {
          Request: ["run"], Response: ["run"],
          UserAPI: ["run"], AgentAPI: [],
          Property: [], Program: "Test",
          EHU: "LinkCore.OMU", Log: "LinkCore.OMU",
          APIDescriptors: [{
            apiVersion: 1, id: "example." + visibility + ".run",
            owner: "Example." + visibility, action: "run",
            version: "1.0.0", visibility, sideEffect: "none",
            inputSchema: { type: "object" },
            outputSchema: { type: "object" }
          }]
        }
      });
      for (const v of ["Public", "Protected", "Private"]) {
        core.register(object(v));
      }
      const guest = core.discover("guest", "list", "api");
      const owner = core.discover("Example.Private", "list", "api");
      const hidden = core.discover("guest", "describe", "api", {
        id: "example.Private.run", owner: "Example.Private"
      });
      return {
        guest: guest.value.total,
        owner: owner.value.total,
        hidden: hidden.status,
        missing: core.discover("ghost", "list", "api").status,
        legacy: typeof window.Cluster?.log === "function"
      };
    });
    expect(result).toEqual({
      guest: 1, owner: 2, hidden: 404, missing: 404, legacy: true
    });
  });
