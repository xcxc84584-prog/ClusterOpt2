import { test, expect } from "@playwright/test";

test("PR23 tabbed plugin window and sandboxed view through Hub",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      core.register({
        id: "plugin.demo",
        receive: async () => null,
        ocda: {
          Request: ["run"], Response: ["run"],
          UserAPI: ["run"], AgentAPI: [],
          Property: [], Program: "Plugin",
          EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
        }
      });
      const empty = { type: "object" };
      const permissions = ["ui.read", "ui.window",
        "ui.update.own", "ui.navigation"];
      const manifest = core.registerProvider("plugin.demo", {
        manifestVersion: 1, providerId: "plugin.demo",
        objectId: "plugin.demo",
        provides: [{
          service: "plugin.demo.run", action: "run",
          version: "1.0.0", inputSchema: empty, outputSchema: empty
        }],
        requires: [], permissions,
        execution: { isolation: "worker", concurrency: "serial" }
      });
      for (const permission of permissions) {
        core.grantPluginPermission(
          "plugin.demo", "plugin.demo", permission, true);
      }
      core.pluginHostInstaller.uiHost.views.set("plugin.demo", {
        enabled: true,
        provider: { providerId: "plugin.demo",
          objectId: "plugin.demo" },
        snapshot: {
          manifestText: JSON.stringify({
            name: "Demo", uiEntry: "views/index.html"
          }),
          files: {
            "views/settings.html": btoa(
              "<main><h1>Installed Settings</h1></main>")
          }
        }
      });
      const send = (action, payload, requestId) =>
        core.request("plugin.demo", "UICO", "uiRequest", {
          protocol: "cluster.ui/1", requestId,
          targetId: "UICO", action,
          payload: { providerId: "plugin.demo", ...payload }
        }, { origin: "user" });
      const created = await send("UI.OpenWindow", {
        kind: "window", parentId: "slot.plugin-window",
        props: { text: "Settings" }
      }, "window1");
      const uiId = created.value?.data.uiId;
      const tab = await send("UI.AddTab", {
        uiId, tabId: "general", title: "General"
      }, "addtab1");
      const navigated = await send("UI.NavigatePluginView", {
        uiId, viewId: "settings"
      }, "navigate1");
      const window = document.querySelector(
        '[data-cluster-plugin-ui="' + uiId + '"]');
      const frame = window?.querySelector("iframe");
      const frameAttributes = {
        sandbox: frame?.getAttribute("sandbox"),
        srcdoc: frame?.getAttribute("srcdoc"),
        src: frame?.getAttribute("src")
      };
      const missing = await send("UI.NavigatePluginView", {
        uiId, viewId: "missing"
      }, "missing-view");
      const hidden = await send("UI.SetVisibility", {
        uiId, visible: false
      }, "hide1");
      const wasHidden = window?.hidden;
      const visible = await send("UI.SetVisibility", {
        uiId, visible: true
      }, "show1");
      const removedTab = await send("UI.RemoveTab", {
        uiId, tabId: "general"
      }, "remove-tab1");
      const closing = await send("UI.CloseWindow", {
        uiId
      }, "close-window1");
      return {
        manifest: manifest.status, created: created.status,
        tab: tab.status, navigated: navigated.status,
        missing: missing.status,
        frameAttributes,
        hidden: hidden.status, wasHidden,
        visible: visible.status, removedTab: removedTab.status,
        closing: closing.status,
        remains: Boolean(document.querySelector(
          '[data-cluster-plugin-ui="' + uiId + '"]'))
      };
    });
    expect(result.manifest).toBe(201);
    expect(result.created).toBe(200);
    expect(result.tab).toBe(200);
    expect(result.navigated).toBe(200);
    expect(result.frameAttributes.sandbox).toBe("allow-scripts");
    expect(result.frameAttributes.src).toBe(null);
    expect(result.frameAttributes.srcdoc).toContain(
      "Installed Settings");
    expect(result.frameAttributes.srcdoc).toContain(
      "Content-Security-Policy");
    expect(result.missing).toBe(404);
    expect(result.hidden).toBe(200);
    expect(result.wasHidden).toBe(true);
    expect(result.visible).toBe(200);
    expect(result.removedTab).toBe(200);
    expect(result.closing).toBe(200);
    expect(result.remains).toBe(false);
  }
);
