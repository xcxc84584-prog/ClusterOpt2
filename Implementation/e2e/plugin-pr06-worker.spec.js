import { test, expect } from "@playwright/test";

test("PR06.03 real Chromium trusted Worker RPC and timeout boundary",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      core.register({
        id: "Owner", receive: async () => null,
        ocda: { Request: ["run"], Response: [],
          UserAPI: ["run"], AgentAPI: [], Property: [],
          Program: {}, EHU: [], Log: [] }
      });
      core.registerProvider("Owner", {
        manifestVersion: 1, providerId: "vendor.worker",
        objectId: "Owner", provides: [{
          service: "test.worker", action: "run", version: "1.0.0",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" }
        }],
        requires: [], permissions: [],
        execution: { isolation: "worker", concurrency: "serial" }
      });
      const echo = await core.invokeTrustedPluginWorker(
        "Owner", "vendor.worker", "echo", { value: 5 });
      const lines = await core.invokeTrustedPluginWorker(
        "Owner", "vendor.worker", "lineCount", { text: "a\nb" });
      const blocked = await core.invokeTrustedPluginWorker(
        "Owner", "vendor.worker", "echo", { value: 1 },
        { source: { kind: "external" } });
      return {
        echo: echo.value?.value, lines: lines.value?.lines,
        blocked: blocked.status,
        publicWorker: typeof window.Cluster.invokeTrustedPluginWorker
      };
    });
    expect(result).toEqual({
      echo: 5, lines: 2, blocked: 403,
      publicWorker: "undefined"
    });
  });
