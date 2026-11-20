import { test, expect } from "@playwright/test";

test("PR24.24/35/51-60 independent plugin calls another via HubUnit",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const importer = async name => {
        const root = "/Implementation/sdk/examples/" + name + "/";
        const [manifestResponse, codeResponse] = await Promise.all([
          fetch(root + "plugin.json"), fetch(root + "worker.js")
        ]);
        if (!manifestResponse.ok || !codeResponse.ok) {
          throw Error("Missing independent plugin fixture");
        }
        const manifestText = await manifestResponse.text();
        const source = await codeResponse.text();
        const manifest = JSON.parse(manifestText);
        return {
          manifest, snapshot: {
            format: "cluster-plugin-folder", formatVersion: 1,
            manifestText,
            files: {
              "plugin.json": btoa(manifestText),
              "worker.js": btoa(source)
            }
          }
        };
      };
      const host = linkCore.pluginHostInstaller;
      const echo = await importer("echo");
      const delegate = await importer("delegate");
      const installedEcho = await host.install(echo.snapshot, {
        consented: true
      });
      if (!installedEcho.ok) return { installedEcho };
      try {
        const installedDelegate = await host.install(
          delegate.snapshot, {
            consented: true,
            approvedRpcScopes: delegate.manifest.rpcScopes
          });
        if (!installedDelegate.ok) return { installedDelegate };
        try {
          const response = await linkCore.request(
            "ui", delegate.manifest.provider.objectId, "delegate",
            { message: "external-sdk-call" }, { origin: "user" });
          const operations = linkCore.getSnapshot().logs.filter(item =>
            item.action === "Request.echo" &&
            item.source === delegate.manifest.provider.objectId);
          const active = host.handles.get(
            delegate.manifest.provider.providerId)
            .hostTransport.gateway.sessions.activeCount;
          return {
            installedEcho: installedEcho.status,
            installedDelegate: installedDelegate.status,
            response, dependencyEvents: operations.length,
            active, echoOwner: echo.manifest.provider.objectId
          };
        } finally {
          host.uninstall(delegate.manifest.provider.providerId);
        }
      } finally {
        host.uninstall(echo.manifest.provider.providerId);
      }
    });
    expect(result.installedEcho, JSON.stringify(result)).toBe(201);
    expect(result.installedDelegate).toBe(201);
    expect(result.response.status, JSON.stringify(result)).toBe(200);
    expect(result.response.value.echoed).toEqual({
      echoed: "external-sdk-call", sdkVersion: "1.0.0"
    });
    expect(result.response.value.denied).toEqual({
      code: "REQUEST_DENIED", status: 403
    });
    expect(result.response.value.hasReady).toBe(true);
    expect(result.dependencyEvents).toBeGreaterThanOrEqual(1);
    expect(result.active).toBe(1);
    expect(result.echoOwner).toBe("SDK.ExampleEcho");
  });

test("PR24.53 Worker handlers cannot register undeclared actions",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const manifest = {
        packageVersion: 1, name: "SDK Handler ACL",
        entry: "worker.js",
        provider: {
          manifestVersion: 1, providerId: "example.sdk.handler-acl",
          objectId: "SDK.HandlerACL", provides: [{
            service: "example.sdk.handler-acl", action: "probe",
            version: "1.0.0", inputSchema: { type: "object" },
            outputSchema: { type: "object" }
          }],
          requires: [], permissions: [],
          execution: { isolation: "worker", concurrency: "serial" }
        }
      };
      const code = [
        "let blocked = false;",
        "try { Cluster.handle('undeclared', () => ({})); }",
        "catch (error) { blocked = error instanceof TypeError; }",
        "Cluster.handle('probe', () => ({ blocked }));"
      ].join("\n");
      const raw = JSON.stringify(manifest);
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: {
          "plugin.json": btoa(raw), "worker.js": btoa(code)
        }
      };
      const host = linkCore.pluginHostInstaller;
      const installed = await host.install(snapshot, { consented: true });
      if (!installed.ok) return { installed };
      try {
        const reply = await linkCore.request(
          "ui", "SDK.HandlerACL", "probe", {}, { origin: "user" });
        return { installed: installed.status, reply };
      } finally {
        host.uninstall(manifest.provider.providerId);
      }
    });
    expect(result.installed, JSON.stringify(result)).toBe(201);
    expect(result.reply.status, JSON.stringify(result)).toBe(200);
    expect(result.reply.value.blocked).toBe(true);
  });
