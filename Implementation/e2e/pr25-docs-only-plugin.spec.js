import { test, expect } from "@playwright/test";

/**
 * Documentation-only plugin probe. The Worker uses only the declared
 * public Cluster SDK and a package manifest. No host module is imported
 * or referenced by the third-party source.
 */
test("PR25 docs-only third-party Worker installs and runs through RPC",
  async ({ page }) => {
    await page.goto("/");
    const actual = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const manifest = {
        packageVersion: 1,
        name: "External Docs Blind",
        entry: "worker.js",
        provider: {
          manifestVersion: 1,
          providerId: "docs.blind.echo",
          objectId: "Docs.BlindEcho",
          provides: [{
            service: "docs.blind.echo", action: "ping",
            version: "1.0.0",
            inputSchema: { type: "object", properties: {
              message: { type: "string" }
            }, required: ["message"] },
            outputSchema: { type: "object", properties: {
              echo: { type: "string" },
              session: { type: "array",
                items: { type: "string" } }
            }, required: ["echo", "session"] }
          }],
          requires: [], permissions: [],
          execution: { isolation: "worker", concurrency: "serial" }
        },
        rpcScopes: []
      };
      const worker = [
        'const states = [];',
        'Cluster.onSessionChange(state => states.push(state));',
        'Cluster.handle("ping", payload => ({',
        '  echo: String(payload.message ?? ""),',
        '  session: states.slice()',
        '}));'
      ].join("\n");
      const manifestText = JSON.stringify(manifest);
      const installed = await linkCore.pluginHostInstaller.install({
        format: "cluster-plugin-folder",
        formatVersion: 1, manifestText,
        files: {
          "plugin.json": btoa(manifestText),
          "worker.js": btoa(worker)
        }
      }, { consented: true });
      if (!installed.ok) return { installed };
      try {
        const result = await linkCore.request("ui",
          "Docs.BlindEcho", "ping",
          { message: "docs-only" }, { origin: "user" });
        return { installed: installed.status, result };
      } finally {
        linkCore.pluginHostInstaller.uninstall("docs.blind.echo");
      }
    });
    expect(actual.installed, JSON.stringify(actual)).toBe(201);
    expect(actual.result.status, JSON.stringify(actual)).toBe(200);
    expect(actual.result.value.echo).toBe("docs-only");
    expect(actual.result.value.session).toContain("ready");
  });
