import { test, expect } from "@playwright/test";

test("PR23 UI.Batch preflight and atomic lifecycle through HubUnit",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      core.register({
        id: "plugin.demo", receive: async () => null,
        ocda: {
          Request: ["run"], Response: ["run"],
          UserAPI: ["run"], AgentAPI: [],
          Property: [], Program: "Plugin",
          EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
        }
      });
      const empty = { type: "object" };
      core.registerProvider("plugin.demo", {
        manifestVersion: 1, providerId: "plugin.demo",
        objectId: "plugin.demo",
        provides: [{
          service: "plugin.demo.run", action: "run",
          version: "1.0.0", inputSchema: empty, outputSchema: empty
        }],
        requires: [],
        permissions: ["ui.create.own", "ui.update.own"],
        execution: { isolation: "worker", concurrency: "serial" }
      });
      for (const permission of ["ui.create.own", "ui.update.own"]) {
        core.grantPluginPermission("plugin.demo",
          "plugin.demo", permission, true);
      }
      const send = (action, payload, requestId) =>
        core.request("plugin.demo", "UICO", "uiRequest", {
          protocol: "cluster.ui/1", requestId,
          targetId: "UICO", action, payload: {
            providerId: "plugin.demo", ...payload
          }
        }, { origin: "user" });
      const initial = await send("UI.Create", {
        kind: "button", parentId: "slot.plugin-toolbar",
        props: { text: "Original" }
      }, "initial1");
      const uiId = initial.value.data.uiId;
      const node = document.querySelector(
        '[data-cluster-plugin-ui="' + uiId + '"]');
      const invalid = await send("UI.Batch", {
        operations: [
          { action: "UI.Update", payload: {
            uiId, props: { text: "MUST NOT COMMIT" }
          }},
          { action: "UI.Create", payload: {
            kind: "button", parentId: "slot.invalid",
            props: { text: "Rejected" }
          }}
        ]
      }, "invalid-batch");
      const afterInvalid = node?.textContent;
      const valid = await send("UI.Batch", {
        operations: [
          { action: "UI.Update", payload: {
            uiId, props: { text: "Committed" },
            expectedRevision: 1
          }},
          { action: "UI.Create", payload: {
            kind: "button", parentId: "slot.plugin-toolbar",
            props: { text: "New Control" }
          }}
        ]
      }, "batch2");
      const afterValid = node?.textContent;
      const newId = valid.value?.data?.operations?.[1]?.uiId;
      const exists = Boolean(document.querySelector(
        '[data-cluster-plugin-ui="' + newId + '"]'));
      const removal = await send("UI.Batch", {
        operations: [
          { action: "UI.Remove", payload: { uiId }},
          { action: "UI.Remove", payload: { uiId: newId }}
        ]
      }, "batch3");
      return {
        initial: initial.status, invalid: invalid.status,
        afterInvalid, valid: valid.status,
        afterValid, exists, removal: removal.status,
        remaining: core.uiControl.adapter.nodes.size,
        errors: core.omu.snapshot().logs.some(log =>
          log.kind === "EHU" && log.status === 403)
      };
    });
    expect(result.initial).toBe(200);
    expect(result.invalid).toBe(403);
    expect(result.afterInvalid).toBe("Original");
    expect(result.valid).toBe(200);
    expect(result.afterValid).toBe("Committed");
    expect(result.exists).toBe(true);
    expect(result.removal).toBe(200);
    expect(result.remaining).toBe(0);
    expect(result.errors).toBe(true);
  }
);

test("PR23 UI.Batch rollback removes first creation if second commit fails",
  async ({ page }) => {
    await page.goto("/");
    const report = await page.evaluate(async () => {
      const { LinkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const core = new LinkCore();
      core.register({
        id: "plugin.demo", receive: async () => null,
        ocda: {
          Request: ["run"], Response: ["run"],
          UserAPI: ["run"], AgentAPI: [],
          Property: [], Program: "Plugin",
          EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
        }
      });
      const empty = { type: "object" };
      core.registerProvider("plugin.demo", {
        manifestVersion: 1, providerId: "plugin.demo",
        objectId: "plugin.demo", requires: [],
        provides: [{ service: "plugin.demo.run", action: "run",
          version: "1.0.0", inputSchema: empty, outputSchema: empty }],
        permissions: ["ui.create.own", "ui.update.own"],
        execution: { isolation: "worker", concurrency: "serial" }
      });
      for (const permission of ["ui.create.own", "ui.update.own"]) {
        core.grantPluginPermission(
          "plugin.demo", "plugin.demo", permission, true);
      }
      const actualRegister = core.register.bind(core);
      core.register = object => object.id.endsWith("rollback_1") ?
        false : actualRegister(object);
      const response = await core.request(
        "plugin.demo", "UICO", "uiRequest", {
          protocol: "cluster.ui/1",
          requestId: "rollback", targetId: "UICO",
          action: "UI.Batch", payload: {
            providerId: "plugin.demo",
            operations: [0, 1].map(index => ({
              action: "UI.Create", payload: {
                kind: "button", parentId: "slot.plugin-toolbar",
                props: { text: "Rollback " + index }
              }
            }))
          }
        }, { origin: "user" });
      return {
        status: response.status,
        firstRegistered: core.uru.objects.has(
          "UICO.plugin.demo.rollback_0"),
        secondRegistered: core.uru.objects.has(
          "UICO.plugin.demo.rollback_1"),
        firstDOM: Boolean(document.querySelector(
          '[data-cluster-plugin-ui="plugin.demo.rollback_0"]')),
        secondDOM: Boolean(document.querySelector(
          '[data-cluster-plugin-ui="plugin.demo.rollback_1"]')),
        adapterCount: core.uiControl.adapter.nodes.size,
        ehu: core.omu.snapshot().logs.some(entry =>
          entry.kind === "EHU" && entry.status === 409)
      };
    });
    expect(report.status).toBe(409);
    expect(report.firstRegistered).toBe(false);
    expect(report.secondRegistered).toBe(false);
    expect(report.firstDOM).toBe(false);
    expect(report.secondDOM).toBe(false);
    expect(report.adapterCount).toBe(0);
    expect(report.ehu).toBe(true);
  }
);
