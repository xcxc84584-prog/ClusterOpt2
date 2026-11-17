import { test, expect } from "@playwright/test";

const token = "f".repeat(64);
const secret = "sk-" + "a".repeat(20);

async function mountWithMockAgent(page) {
  return page.evaluate(async () => {
    const { linkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const files = {};
    const names = ["plugin.json", "worker.js", "index.html",
      "README.md", "locales/en.json", "locales/zh-Hant.json"];
    for (const name of names) {
      const response = await fetch(
        "/Implementation/plugins/ai-agent-mcp/" + name);
      const bytes = new Uint8Array(await response.arrayBuffer());
      files[name] = btoa(String.fromCharCode(...bytes));
    }
    const manifestText = await (await fetch(
      "/Implementation/plugins/ai-agent-mcp/plugin.json")).text();
    const result = await linkCore.pluginHostInstaller.install({
      format: "cluster-plugin-folder", formatVersion: 1,
      manifestText, files
    }, { consented: true, approvedPermissions: [
      "network.request", "local-agent.pair",
      "model.configure", "model.task"
    ] });
    if (!result.ok) return result;
    const agent = linkCore.pluginHostInstaller.uiHost.views
      .get("cluster.ai-agent-mcp").localAgent;
    window.__modelSent = [];
    window.__modelTrace = [];
    const task = linkCore.pluginHostInstaller.uiHost.views
      .get("cluster.ai-agent-mcp").modelTask;
    const reset = task.reset.bind(task);
    task.reset = () => {
      window.__modelTrace.push({ kind: "reset",
        before: task.snapshot(),
        stack: String(new Error().stack).slice(0, 600) });
      return reset();
    };
    const submit = task.submit.bind(task);
    task.submit = async payload => {
      window.__modelTrace.push({ kind: "submit-before",
        before: task.snapshot() });
      const result = await submit(payload);
      window.__modelTrace.push({ kind: "submit-after",
        after: task.snapshot() });
      return result;
    };
    agent.createSocket = () => {
      const socket = {
        onopen: null, onmessage: null, onclose: null,
        closed: false, sent: [],
        send(raw) {
          const message = JSON.parse(raw);
          window.__modelSent.push(message);
          if (message.type === "auth") {
            queueMicrotask(() => socket.onmessage?.({
              data: JSON.stringify({ type: "ready" })
            }));
          } else if (message.type === "provider_set") {
            queueMicrotask(() => socket.onmessage?.({
              data: JSON.stringify({
                type: "provider_info",
                configured: true, model: message.model
              })
            }));
          } else if (message.type === "task") {
            queueMicrotask(() => socket.onmessage?.({
              data: JSON.stringify({
                type: "task_status",
                requestId: message.requestId,
                status: "running", message: "Processing"
              })
            }));
          } else if (message.type === "task_cancel") {
            queueMicrotask(() => socket.onmessage?.({
              data: JSON.stringify({
                type: "task_status",
                requestId: message.requestId,
                status: "interrupted", message: "Cancelled"
              })
            }));
          }
        },
        close() { socket.closed = true; }
      };
      window.__modelSocket = socket;
      queueMicrotask(() => socket.onopen?.());
      return socket;
    };
    return { ok: true, status: 201 };
  });
}

test("PR14.5 model credential stays in host, task route and cancel",
  async ({ page }) => {
    await page.goto("/");
    expect((await mountWithMockAgent(page)).status).toBe(201);
    await page.locator(".plugin-extension-button").click();
    const frame = page.frameLocator(".plugin-extension-frame");
    await frame.locator('[data-agent-action="pair"]').click();
    const tokenDialog = page.locator("dialog[open]");
    await tokenDialog.locator('input[type="password"]').fill(token);
    await tokenDialog.locator('button[type="submit"]').click();
    await expect(frame.locator("[data-agent-status]"))
      .toHaveText("已連線");
    await frame.locator('[data-model-action="configure"]').click();
    const modelDialog = page.locator("dialog[open]");
    await expect(modelDialog).toBeVisible();
    await modelDialog.locator('input[type="password"]').fill(secret);
    await modelDialog.locator('input[type="text"]')
      .fill("gpt-4.1-mini");
    await modelDialog.locator('button[type="submit"]').click();
    await expect(frame.locator("[data-model-output]"))
      .toContainText("模型已設定");
    await frame.locator("textarea").fill("Explain a function");
    await frame.locator('form button[type="submit"]').click();
    await expect.poll(() => page.evaluate(() =>
      window.__modelSent.map(item => item.type)))
      .toContain("task");
    const diagnostic = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const view = linkCore.pluginHostInstaller.uiHost.views.get(
        "cluster.ai-agent-mcp");
      return {
        task: view.modelTask.snapshot(),
        trace: window.__modelTrace,
        agent: view.localAgent.state,
        errors: linkCore.getSnapshot().logs.filter(x =>
          x.kind === "EHU").slice(0,7).map(x => ({
            action: x.action, status: x.status
          }))
      };
    });
    diagnostic.ui = await frame.locator("[data-model-output]")
      .innerText();
    diagnostic.cancelDisabled = await frame.locator(
      '[data-model-action="cancel"]').isDisabled();
    expect(JSON.stringify(diagnostic)).toContain(
      '"cancelDisabled":false');
    await frame.locator('[data-model-action="cancel"]').click();
    await expect.poll(() => page.evaluate(() =>
      window.__modelSent.some(msg => msg.type === "task_cancel")))
      .toBe(true);
    const proof = await page.evaluate(() => {
      const { __modelSent: sent } = window;
      return {
        types: sent.map(item => item.type),
        hasProviderKey: sent.some(item =>
          item.type === "provider_set" &&
          item.apiKey === "sk-" + "a".repeat(20)),
        browserStorageHasKey:
          Object.values(localStorage).some(item =>
            item.includes("sk-" + "a".repeat(20))) ||
          Object.values(sessionStorage).some(item =>
            item.includes("sk-" + "a".repeat(20)))
      };
    });
    expect(proof.types).toEqual([
      "auth", "provider_set", "task", "task_cancel"
    ]);
    expect(proof.hasProviderKey).toBe(true);
    expect(proof.browserStorageHasKey).toBe(false);
    const logged = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return JSON.stringify(linkCore.getSnapshot().logs);
    });
    expect(logged).not.toContain(secret);
  });

test("PR14.5 missing model grant cannot start tasks", async ({ page }) => {
  await page.goto("/");
  expect((await mountWithMockAgent(page)).status).toBe(201);
  const result = await page.evaluate(async () => {
    const { linkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const providerId = "cluster.ai-agent-mcp";
    const objectId = "AIAgentMCP";
    linkCore.revokePluginPermission(objectId, providerId, "model.task");
    const view = linkCore.pluginHostInstaller.uiHost.views.get(providerId);
    return linkCore.request("ui", view.modelTask.id,
      "submit", { prompt: "Denied" }, { origin: "user" });
  });
  expect(result.status).toBe(403);
});

test("PR14.5 full authenticated model result reaches isolated UI",
  async ({ page }) => {
    await page.goto("/");
    expect((await mountWithMockAgent(page)).status).toBe(201);
    await page.locator(".plugin-extension-button").click();
    const frame = page.frameLocator(".plugin-extension-frame");
    await frame.locator('[data-agent-action="pair"]').click();
    await page.locator("dialog[open] input[type=password]")
      .fill(token);
    await page.locator("dialog[open] button[type=submit]").click();
    await expect(frame.locator("[data-agent-status]"))
      .toHaveText("已連線");
    await frame.locator("textarea").fill("Explain one function");
    await frame.locator('form button[type="submit"]').click();
    await expect.poll(() => page.evaluate(() =>
      window.__modelSent.find(item => item.type === "task")
        ?.requestId ?? null)).not.toBeNull();
    // The poll above proves a task WebSocket send, not a named field
    // inside a diagnostic object. Retrieve its actual correlation ID.
    const id = await page.evaluate(() =>
      window.__modelSent.find(item => item.type === "task").requestId);
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    await page.evaluate(taskId => {
      const socket = window.__modelSocket;
      socket.onmessage({
        data: JSON.stringify({
          type: "task_result", requestId: taskId,
          text: "A function maps inputs to outputs."
        })
      });
      socket.onmessage({
        data: JSON.stringify({
          type: "task_status", requestId: taskId,
          status: "completed", message: "Completed"
        })
      });
    }, id);
    await expect(frame.locator("[data-model-output]"))
      .toContainText("A function maps inputs to outputs.");
    await expect.poll(() => page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return linkCore.pluginHostInstaller.uiHost.views.get(
        "cluster.ai-agent-mcp").modelTask.snapshot().activeId;
    })).toBe(null);
    await expect(frame.locator('[data-model-action="cancel"]'))
      .toBeDisabled();
  });
