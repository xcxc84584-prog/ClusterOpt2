import { test, expect } from "@playwright/test";

test("PR23 UI button create/activate/update/remove through HubUnit",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      let activations = 0;
      const object = {
        id: "plugin.demo",
        authorization: { default: "Public" },
        ocda: {
          Request: ["run"], Response: ["run"],
          UserAPI: ["run"], AgentAPI: [],
          Property: [], Program: "Plugin",
          EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
        },
        receive: async action => {
          if (action === "run") activations++;
          return { activations };
        }
      };
      core.register(object);
      const empty = { type: "object" };
      const manifest = core.registerProvider("plugin.demo", {
        manifestVersion: 1, providerId: "plugin.demo",
        objectId: "plugin.demo",
        provides: [{
          service: "plugin.demo.run", action: "run",
          version: "1.0.0",
          inputSchema: empty, outputSchema: empty
        }],
        requires: [],
        permissions: ["ui.read", "ui.create.own", "ui.update.own"],
        execution: { isolation: "worker", concurrency: "serial" }
      });
      const send = (action, payload, requestId, revision) =>
        core.request("plugin.demo", "UICO", "uiRequest", {
          protocol: "cluster.ui/1", requestId,
          targetId: "UICO", action, payload,
          ...(revision === undefined ? {} :
            { expectedRevision: revision })
        }, { origin: "user" });
      const props = {
        kind: "button", parentId: "slot.plugin-toolbar",
        props: { text: "Test Plugin" },
        onActivateAction: "run", providerId: "plugin.demo"
      };
      const denied = await send("UI.Create", props, "req1");
      const grants = ["ui.read", "ui.create.own", "ui.update.own"]
        .map(permission => core.grantPluginPermission(
          "plugin.demo", "plugin.demo", permission, true));
      const created = await send("UI.Create", props, "req2");
      const uiId = created.value?.data?.uiId;
      const button = document.querySelector(
        '[data-cluster-plugin-ui="' + uiId + '"]');
      const textBefore = button?.textContent;
      button?.click();
      await new Promise(resolve => setTimeout(resolve, 100));
      const updated = await send("UI.Update", {
        uiId, props: { text: "Updated Plugin" },
        providerId: "plugin.demo"
      }, "req3", 1);
      const textAfter = button?.textContent;
      const state = await send("UI.GetState", {
        uiId, providerId: "plugin.demo"
      }, "req4");
      const removed = await send("UI.Remove", {
        uiId, providerId: "plugin.demo"
      }, "req5");
      return {
        manifest: manifest.status,
        denied: denied.status,
        grants: grants.map(g => g.status),
        created: created.status,
        createdError: created.error,
        capabilityGranted: core.checkPluginPermission(
          "plugin.demo", "ui.create.own"),
        uicoAction: core.uiControl.ocda.UserAPI,
        createdStatus: created.value?.status,
        textBefore, textAfter, activations,
        updated: updated.status,
        revision: state.value?.data?.revision,
        removed: removed.status,
        exists: Boolean(document.querySelector(
          '[data-cluster-plugin-ui="' + uiId + '"]')),
        registered: core.uru.objects.has("UICO." + uiId),
        audit: core.omu.snapshot().logs.some(log =>
          log.kind === "EHU" && log.status === 403)
      };
    });
    console.log("PR23_DIAGNOSTIC", JSON.stringify(result));
    expect(result.manifest).toBe(201);
    expect(result.denied).toBe(403);
    expect(result.grants).toEqual([200, 200, 200]);
    expect(result.created).toBe(200);
    expect(result.createdStatus).toBe(201);
    expect(result.textBefore).toBe("Test Plugin");
    expect(result.textAfter).toBe("Updated Plugin");
    expect(result.activations).toBe(1);
    expect(result.updated).toBe(200);
    expect(result.revision).toBe(2);
    expect(result.removed).toBe(200);
    expect(result.exists).toBe(false);
    expect(result.registered).toBe(false);
    expect(result.audit).toBe(true);
  }
);
