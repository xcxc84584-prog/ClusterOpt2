import { test, expect } from "@playwright/test";

test("PR06.07 real Chromium SHA-256 verification is non-executable",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { PluginArtifactPolicy } = await import(
        "/Implementation/property/PluginArtifactPolicy.js");
      const { PluginSourcePolicy } = await import(
        "/Implementation/property/PluginSourcePolicy.js");
      const bytes = new TextEncoder().encode("trusted");
      const digest = Array.from(new Uint8Array(
        await crypto.subtle.digest("SHA-256", bytes)),
        x => x.toString(16).padStart(2, "0")).join("");
      const result = await PluginArtifactPolicy.verify(bytes, digest);
      return {
        verified: result.status,
        tampered: (await PluginArtifactPolicy.verify(
          new TextEncoder().encode("tampered"), digest)).status,
        remote: PluginSourcePolicy.inspect({
          kind: "remote"
        }).status,
        publicRuntime: typeof window.Cluster.invokeTrustedPluginWorker
      };
    });
    expect(result).toEqual({
      verified: 200, tampered: 412,
      remote: 403, publicRuntime: "undefined"
    });
  });
