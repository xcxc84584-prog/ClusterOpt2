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
        const files = {
          "plugin.json": btoa(manifestText),
          "worker.js": btoa(source)
        };
        if (manifest.uiEntry) {
          const response = await fetch(root + manifest.uiEntry);
          if (!response.ok) throw Error("Missing plugin UI asset");
          files[manifest.uiEntry] = btoa(await response.text());
        }
        return {
          manifest, snapshot: {
            format: "cluster-plugin-folder", formatVersion: 1,
            manifestText, files
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

test("PR24.62-70 external SDK UI creates isolated multi-tab view",
  async ({ page }) => {
    await page.goto("/");
    const installed = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const root = "/Implementation/sdk/examples/echo/";
      const [manifestText, worker, html] = await Promise.all([
        fetch(root + "plugin.json").then(r => r.text()),
        fetch(root + "worker.js").then(r => r.text()),
        fetch(root + "index.html").then(r => r.text())
      ]);
      const snapshot = {
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText,
        files: {
          "plugin.json": btoa(manifestText),
          "worker.js": btoa(worker),
          "index.html": btoa(html)
        }
      };
      return linkCore.pluginHostInstaller.install(snapshot, {
        consented: true
      });
    });
    expect(installed.status, JSON.stringify(installed)).toBe(201);
    const launch = page.locator(
      '.plugin-extension-button[title="SDK Echo (External)"]');
    await expect(launch).toBeVisible();
    await launch.click();
    const pluginTab = page.locator(
      '#tabs .plugin-agent-tab[data-tab-id="plugin:example.sdk.echo"]');
    await expect(pluginTab).toBeVisible();
    const frame = page.frameLocator(
      'iframe.plugin-extension-frame[title="SDK Echo (External)"]');
    await expect(frame.getByText("Independent, sandboxed UI")).toBeVisible();
    await frame.getByRole("tab", { name: "Advanced" }).click();
    await expect(frame.getByRole("heading", {
      name: "Advanced"
    })).toBeVisible();
    await frame.getByRole("tab", { name: "General" }).click();
    await frame.getByRole("button", { name: "Local action" }).click();
    await expect(frame.getByRole("status")).toHaveText("Ready");
    const isolation = await page.evaluate(() => {
      const iframe = document.querySelector(
        'iframe.plugin-extension-frame[title="SDK Echo (External)"]');
      try {
        return Boolean(iframe.contentWindow.document.body);
      } catch {
        return false;
      }
    });
    expect(isolation).toBe(false);
    const cleanup = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return linkCore.pluginHostInstaller.uninstall("example.sdk.echo");
    });
    expect(cleanup.status).toBe(200);
    await expect(pluginTab).toHaveCount(0);
    await expect(launch).toHaveCount(0);
  });
