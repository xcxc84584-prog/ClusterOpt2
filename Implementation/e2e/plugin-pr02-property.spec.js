import { test, expect } from "@playwright/test";

test("PR02.03 real Chromium EDPMU descriptor integration",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      const descriptor = {
        apiVersion: 1, name: "DemoProperty", type: "object",
        owners: ["LinkCore"], visibility: "Public",
        readable: true, writable: false,
        invariants: ["No direct mutation"]
      };
      const added = core.hub.registerProperty("DemoProperty", { x: 1 }, {
        owners: ["LinkCore"], visibility: "Public", descriptor
      });
      core.register({ id: "ui", receive: async () => null });
      const described = core.edpmu.describeProperty("DemoProperty");
      const read = core.readProperty("ui", "DemoProperty");
      const denied = core.readProperty("ghost", "DemoProperty");
      const invalid = core.hub.registerProperty("BadProperty", {}, {
        owners: ["LinkCore"], visibility: "Public",
        descriptor: { ...descriptor, name: "DemoProperty" }
      });
      return {
        added: added.status, described: described.status,
        frozen: Object.isFrozen(described.value.owners),
        read: read.status, denied: denied.status,
        invalid: invalid.status,
        ehu: core.getSnapshot().logs.some(row =>
          row.kind === "EHU" && row.status === 400),
        legacyFacade: typeof window.Cluster?.version === "function"
      };
    });
    expect(result).toEqual({
      added: 201, described: 200, frozen: true, read: 200,
      denied: 404, invalid: 400, ehu: true, legacyFacade: true
    });
  });
