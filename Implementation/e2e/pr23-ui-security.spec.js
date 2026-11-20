import { test, expect } from "@playwright/test";

test("PR23.8 native writes fail closed; plugin events unsubscribe cleanly",
  async ({ page }) => {
    await page.goto("/");
    const out = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      let hits = 0;
      core.register({
        id: "plugin.demo",
        receive: async action => {
          if (action === "run") hits++;
          return { hits };
        },
        authorization: { default: "Public" },
        ocda: {
          Request: ["run"], Response: ["run"],
          UserAPI: ["run"], AgentAPI: [], Property: [],
          Program: "Test", EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
        }
      });
      const empty = { type: "object" };
      const permissions = ["ui.read", "ui.create.own", "ui.update.own"];
      core.registerProvider("plugin.demo", {
        manifestVersion: 1, providerId: "plugin.demo",
        objectId: "plugin.demo",
        requires: [], permissions,
        provides: [{
          service: "plugin.demo.run", action: "run",
          version: "1.0.0", inputSchema: empty, outputSchema: empty
        }],
        execution: { isolation: "worker", concurrency: "serial" }
      });
      for (const permission of permissions) {
        core.grantPluginPermission("plugin.demo",
          "plugin.demo", permission, true);
      }
      const node = document.getElementById("menuBtn");
      const geometry = () => {
        const rect = node.getBoundingClientRect();
        return { space: "viewport", x: rect.x, y: rect.y,
          width: rect.width, height: rect.height };
      };
      const registered = core.uiControl.registerHostSurface({
        uiId: "menuBtn", kind: "button", parentId: "root",
        owner: "LinkCore", revision: 0,
        geometry: geometry(), appearance: {},
        interaction: {}, accessibility: {}
      }, geometry);
      const send = (action, payload, id) =>
        core.request("plugin.demo", "UICO", "uiRequest", {
          protocol: "cluster.ui/1", requestId: id,
          targetId: "UICO", action,
          payload: { providerId: "plugin.demo", ...payload }
        }, { origin: "user" });
      const beforeText = node.textContent;
      const forbidden = await send("UI.Update", {
        uiId: "menuBtn", props: { text: "unauthorized" }
      }, "native-update");
      const removal = await send("UI.Remove", {
        uiId: "menuBtn"
      }, "native-remove");
      const batch = await send("UI.Batch", {
        operations: [{ action: "UI.Remove", payload: {
          uiId: "menuBtn"
        }}]
      }, "native-batch");
      const originalWidth = node.style.width;
      node.style.width = "321px";
      const liveProperty = await send("UI.GetProperty", {
        uiId: "menuBtn", property: "geometry"
      }, "native-geometry");
      node.style.width = originalWidth;
      const create = await send("UI.Create", {
        kind: "button", parentId: "slot.plugin-toolbar",
        props: { text: "Subscribe" }
      }, "owned-button");
      const uiId = create.value?.data?.uiId;
      const control = document.querySelector(
        '[data-cluster-plugin-ui="' + uiId + '"]');
      const subscribed = await send("UI.Subscribe", {
        uiId, subscriptionId: "run"
      }, "subscribe1");
      control.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const beforeStop = hits;
      const stopped = await send("UI.Unsubscribe", {
        uiId, subscriptionId: "run"
      }, "unsubscribe1");
      control.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const afterStop = hits;
      const cleanup = await send("UI.Remove", {
        uiId
      }, "remove1");
      return {
        registered: registered.status,
        forbidden: forbidden.status,
        removal: removal.status, batch: batch.status,
        nativeUnchanged: node.textContent === beforeText,
        live: liveProperty.value?.data?.value?.width,
        create: create.status, subscribed: subscribed.status,
        stopped: stopped.status, beforeStop, afterStop,
        cleanup: cleanup.status,
        ehu: core.omu.snapshot().logs.filter(entry =>
          entry.kind === "EHU" && entry.status === 403).length
      };
    });
    expect(out.registered).toBe(201);
    expect(out.forbidden).toBe(403);
    expect(out.removal).toBe(403);
    expect(out.batch).toBe(403);
    expect(out.nativeUnchanged).toBe(true);
    expect(out.live).toBe(321);
    expect(out.create).toBe(200);
    expect(out.subscribed).toBe(200);
    expect(out.stopped).toBe(200);
    expect(out.beforeStop).toBe(1);
    expect(out.afterStop).toBe(1);
    expect(out.cleanup).toBe(200);
    expect(out.ehu).toBeGreaterThanOrEqual(3);
  }
);
