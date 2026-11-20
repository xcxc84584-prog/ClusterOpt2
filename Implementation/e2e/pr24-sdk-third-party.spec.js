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

test("PR24.22 production Host invokes Worker through Session Controller",
  async ({ page }) => {
    await page.goto("/");
    const reply = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const root = "/Implementation/sdk/examples/echo/";
      const [manifestText, worker, html] = await Promise.all([
        fetch(root + "plugin.json").then(r => r.text()),
        fetch(root + "worker.js").then(r => r.text()),
        fetch(root + "index.html").then(r => r.text())
      ]);
      // A test-only handler records which Host requests reach the
      // isolated Worker, without changing any application UI.
      const scopedManifest = JSON.parse(manifestText);
      scopedManifest.provider.provides.push({
        service: "example.sdk.echo.history", action: "history",
        version: "1.0.0", inputSchema: { type: "object" },
        outputSchema: { type: "object" }
      });
      const scopedWorker = [
        "const calls = [];",
        "const sends = [];",
        "const originalSend = MessagePort.prototype.postMessage;",
        "MessagePort.prototype.postMessage = function(packet, ...args) {",
        "  if (packet?.direction === 'host-to-plugin' &&",
        "      packet?.type === 'response') sends.push(packet.requestId);",
        "  return originalSend.call(this, packet, ...args);",
        "};",
        "Cluster.handle('echo', payload => {",
        "  calls.push(String(payload.message ?? ''));",
        "  return { echoed: String(payload.message ?? ''),",
        "    sdkVersion: Cluster.version,",
        "    ...(payload.message === 'through-hub' ?",
        "      { history: [...calls], sends: [...sends] } : {}) };",
        "});",
        "Cluster.handle('history', () => ({ calls }));"
      ].join("\n");
      const host = linkCore.pluginHostInstaller;
      const install = await host.install({
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: JSON.stringify(scopedManifest), files: {
          "plugin.json": btoa(JSON.stringify(scopedManifest)),
          "worker.js": btoa(scopedWorker), "index.html": btoa(html)
        }
      }, { consented: true });
      if (!install.ok) return { install };
      const bridge = host.handles.get("example.sdk.echo");
      const emitted = [];
      const send = bridge.port.postMessage.bind(bridge.port);
      bridge.port.postMessage = (...args) => {
        if (args[0]?.direction === "host-to-plugin") {
          emitted.push({ type: args[0].type,
            requestId: args[0].requestId });
        }
        return send(...args);
      };
      try {
        let ready = false;
        for (let i = 0; i < 60; i++) {
          const session = bridge.hostTransport.gateway.sessions
            .sessionForPort(bridge.port);
          if (session?.state === "ready") {
            ready = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        if (!ready) return { ready };
        const direct = await bridge.invokeBidirectional(
          "example.sdk.echo", "echo", { message: "new-protocol" });
        const secondDirect = await bridge.invokeBidirectional(
          "example.sdk.echo", "echo", { message: "second-protocol" });
        const routed = await linkCore.request(
          "ui", "SDK.ExampleEcho", "echo",
          { message: "through-hub" }, { origin: "user" });
        const history = await linkCore.request(
          "ui", "SDK.ExampleEcho", "history", {},
          { origin: "user" });
        const events = linkCore.getSnapshot().logs.filter(event =>
          event.action === "RPC.HostToPlugin.Response");
        return {
          ready, direct, secondDirect, routed,
          history: routed.value?.history,
          workerSends: routed.value?.sends,
          emitted, historyStatus: history.status,
          responseEvents: events.length,
          lastEvent: events.at(-1)?.eventId,
          controllerPending: bridge.hostController.pendingCount,
          diagnostics: linkCore.getSnapshot().logs.filter(event =>
            event.action.startsWith("Plugin.RPC.") ||
            event.action.startsWith("RPC.HostToPlugin.") ||
            event.action.startsWith("Plugin.Invoke.")).slice(-15)
            .map(event => ({
              action: event.action, status: event.status
            }))
        };
      } finally {
        host.uninstall("example.sdk.echo");
      }
    });
    expect(reply.ready, JSON.stringify(reply)).toBe(true);
    expect(reply.direct.status, JSON.stringify(reply)).toBe(200);
    expect(reply.direct.value).toEqual({
      echoed: "new-protocol", sdkVersion: "1.0.0"
    });
    expect(reply.secondDirect.status,
      JSON.stringify(reply)).toBe(200);
    expect(reply.routed.status, JSON.stringify(reply)).toBe(200);
    expect(reply.routed.value.echoed).toBe("through-hub");
    expect(reply.responseEvents).toBeGreaterThanOrEqual(2);
    expect(reply.lastEvent).toBeGreaterThan(0);
  });

test("PR24.25 Host-to-Plugin cancellation suppresses stale Worker reply",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const manifest = {
        packageVersion: 1, name: "SDK cancellation",
        entry: "worker.js",
        provider: {
          manifestVersion: 1,
          providerId: "example.sdk.cancel",
          objectId: "SDK.Cancel",
          provides: [{
            service: "example.sdk.cancel", action: "hang",
            version: "1.0.0", inputSchema: { type: "object" },
            outputSchema: { type: "object" }
          }],
          requires: [], permissions: [],
          execution: { isolation: "worker", concurrency: "serial" }
        }
      };
      const raw = JSON.stringify(manifest);
      const source = [
        "Cluster.handle('hang', (_payload, context) =>",
        "  new Promise(resolve => {",
        "    context.signal.addEventListener('abort', () =>",
        "      resolve({ aborted: true }), { once: true });",
        "  }));"
      ].join("\n");
      const host = linkCore.pluginHostInstaller;
      const installed = await host.install({
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText: raw,
        files: {
          "plugin.json": btoa(raw), "worker.js": btoa(source)
        }
      }, { consented: true });
      if (!installed.ok) return { installed };
      const bridge = host.handles.get("example.sdk.cancel");
      try {
        let ready = false;
        for (let i = 0; i < 60; i++) {
          const session = bridge.hostTransport.gateway.sessions
            .sessionForPort(bridge.port);
          if (session?.state === "ready") {
            ready = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        if (!ready) return { ready };
        const pending = bridge.invokeBidirectional(
          "example.sdk.cancel", "hang", {}, 1200);
        const requestId = "host-1";
        const aborted = bridge.hostController.cancel(requestId);
        const reply = await pending;
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          ready, aborted: aborted.status, reply,
          pending: bridge.hostController.pendingCount,
          sessions: bridge.hostTransport.gateway.sessions.activeCount
        };
      } finally {
        host.uninstall("example.sdk.cancel");
      }
    });
    expect(result.ready, JSON.stringify(result)).toBe(true);
    expect(result.aborted).toBe(200);
    expect(result.reply.status).toBe(499);
    expect(result.pending).toBe(0);
    expect(result.sessions).toBe(1);
  });

test("PR24.62/63 independent Worker creates native Button and Window",
  async ({ page }) => {
    await page.goto("/");
    const started = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const root = "/Implementation/sdk/examples/native-ui/";
      const [manifestText, worker] = await Promise.all([
        fetch(root + "plugin.json").then(r => r.text()),
        fetch(root + "worker.js").then(r => r.text())
      ]);
      const manifest = JSON.parse(manifestText);
      const installed = await linkCore.pluginHostInstaller.install({
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText, files: {
          "plugin.json": btoa(manifestText),
          "worker.js": btoa(worker)
        }
      }, {
        consented: true,
        approvedPermissions: manifest.provider.permissions,
        approvedRpcScopes: manifest.rpcScopes
      });
      if (!installed.ok) return { installed };
      const create = await linkCore.request("ui",
        manifest.provider.objectId, "createControls", {},
        { origin: "user" });
      const probe = await linkCore.request("ui",
        manifest.provider.objectId, "probeNativeACL", {},
        { origin: "user" });
      return {
        installed: installed.status, create, probe,
        registered: linkCore.uru.objects.has(
          "UICO." + create.value?.buttonId)
      };
    });
    expect(started.installed, JSON.stringify(started)).toBe(201);
    expect(started.create.status, JSON.stringify(started)).toBe(200);
    expect(started.probe.value.denied).toBe(true);
    expect(started.registered).toBe(true);
    const buttonId = started.create.value.buttonId;
    const windowId = started.create.value.windowId;
    const button = page.locator('[data-cluster-plugin-ui="' +
      buttonId + '"]');
    const settings = page.locator('[data-cluster-plugin-ui="' +
      windowId + '"]');
    await expect(button).toBeVisible();
    await expect(button).toHaveText("External SDK Button");
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("tab", {
      name: "General"
    })).toBeVisible();
    await settings.getByRole("tab", { name: "Advanced" }).click();
    await expect(settings.getByRole("tab", {
      name: "Advanced"
    })).toHaveAttribute("aria-selected", "true");
    await button.click();
    const stats = await page.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, 140));
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const result = await linkCore.request(
        "ui", "SDK.NativeUI", "status", {},
        { origin: "user" });
      const removed = linkCore.pluginHostInstaller.uninstall(
        "example.sdk.native-ui");
      return {
        result, removed: removed.status,
        uiNodes: linkCore.uiControl.adapter.nodes.size,
        ownerGone: !linkCore.uru.objects.has("SDK.NativeUI")
      };
    });
    expect(stats.result.status, JSON.stringify(stats)).toBe(200);
    expect(stats.result.value.presses).toBe(1);
    expect(stats.removed).toBe(200);
    expect(stats.ownerGone).toBe(true);
    await expect(button).toHaveCount(0);
    await expect(settings).toHaveCount(0);
  });
