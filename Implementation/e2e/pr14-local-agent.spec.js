import { test, expect } from "@playwright/test";

const providerId = "cluster.ai-agent-mcp";
const token = "b".repeat(64);

async function pairInline(page, tokenValue) {
  const pair = page.locator(".plugin-agent-inline-pair");
  await expect(pair).toBeVisible();
  await pair.getByLabel("Local Agent port").fill("43881");
  await pair.getByLabel("Pairing token").fill(tokenValue);
  await pair.locator('button[type="submit"]').click();
}

async function install(page) {
  return page.evaluate(async () => {
    const { linkCore } = await import(
      "/Implementation/LinkCore/LinkCore.js");
    const names = ["plugin.json", "worker.js", "index.html",
      "README.md", "locales/en.json", "locales/zh-Hant.json"];
    const files = {};
    for (const name of names) {
      const result = await fetch(
        "/Implementation/plugins/ai-agent-mcp/" + name);
      const bytes = new Uint8Array(await result.arrayBuffer());
      files[name] = btoa(String.fromCharCode(...bytes));
    }
    const manifestText = await (await fetch(
      "/Implementation/plugins/ai-agent-mcp/plugin.json")).text();
    const snapshot = { format: "cluster-plugin-folder",
      formatVersion: 1, manifestText, files };
    const denied = await linkCore.pluginHostInstaller.install(snapshot, {
      consented: true, approvedPermissions: []
    });
    const approved = await linkCore.pluginHostInstaller.install(snapshot, {
      consented: true, approvedPermissions: ["network.request", "local-agent.pair",
      "model.configure", "model.task",
      "shell.execute", "mcp.read"]
    });
    const view = linkCore.pluginHostInstaller.uiHost.views.get(
      "cluster.ai-agent-mcp");
    if (!view) return { denied: denied.status, approved };
    const agent = view.localAgent;
    window.__agentSent = [];
    agent.createSocket = () => {
      const socket = {
        closed: false,
        onopen: null, onmessage: null, onerror: null, onclose: null,
        send(raw) {
          const message = JSON.parse(raw);
          window.__agentSent.push(message);
          if (message.type === "auth") {
            queueMicrotask(() => socket.onmessage?.({
              data: JSON.stringify({ type: "ready", maxSessions: 8 })
            }));
          }
          if (message.type === "ping") {
            queueMicrotask(() => socket.onmessage?.({
              data: JSON.stringify({ type: "pong",
                requestId: message.requestId })
            }));
          }
          if (message.type === "bridge_register") {
            queueMicrotask(() => socket.onmessage?.({
              data: JSON.stringify({ type: "bridge_registered" })
            }));
          }
        },
        close() { socket.closed = true; }
      };
      window.__agentSocket = socket;
      queueMicrotask(() => socket.onopen?.());
      return socket;
    };
    return { denied: denied.status, approved: approved.status };
  });
}

test("PR14.4 local pairing is host-owned, authorized and revocable",
  async ({ page }) => {
    await page.goto("/");
    const state = await install(page);
    expect(state).toEqual({ denied: 403, approved: 201 });
    await page.locator(".plugin-extension-button").click();
    const frame = page.frameLocator(".plugin-extension-frame");
    await pairInline(page, token);
    await expect(frame.locator("[data-agent-status]"))
      .toHaveText("已連線");
    await frame.locator('[data-agent-action="ping"]').click();
    await expect(frame.locator("[data-agent-error]")).toBeEmpty();
    await expect.poll(() => page.evaluate(() =>
      window.__agentSent.map(item => item.type)))
      .toEqual(["auth", "ping"]);
    const recorded = await page.evaluate(() => ({
      sent: window.__agentSent.map(x => x.type),
      iframeCannotReadHost: (() => {
        try {
          return !document.querySelector(".plugin-extension-frame")
            .contentWindow.document;
        } catch { return true; }
      })(),
      hasStoredToken: Object.values(localStorage)
        .some(value => value === "b".repeat(64))
    }));
    expect(recorded.sent).toEqual(["auth", "ping"]);
    expect(recorded.iframeCannotReadHost).toBe(true);
    expect(recorded.hasStoredToken).toBe(false);
    await frame.locator('[data-agent-action="disconnect"]').click();
    await expect(frame.locator("[data-agent-status]"))
      .toHaveText("尚未連線");
    const closed = await page.evaluate(() =>
      window.__agentSocket.closed);
    expect(closed).toBe(true);
  });

test("PR14.4 unsafe tool message terminates authorized connection",
  async ({ page }) => {
    await page.goto("/");
    expect((await install(page)).approved).toBe(201);
    await page.locator(".plugin-extension-button").click();
    const frame = page.frameLocator(".plugin-extension-frame");
    await pairInline(page, token);
    await expect(frame.locator("[data-agent-status]"))
      .toHaveText("已連線");
    await page.evaluate(() => window.__agentSocket.onmessage({
      data: JSON.stringify({ type: "tool_call",
        name: "cluster.powershell_request",
        requestId: "malicious" })
    }));
    await expect(frame.locator("[data-agent-status]"))
      .toHaveText("尚未連線");
    expect(await page.evaluate(() =>
      window.__agentSocket.closed)).toBe(true);
  });

test("PR14.7 ToolBox shell only approves exact command after opt-in",
  async ({ page }) => {
    await page.goto("/");
    expect((await install(page)).approved).toBe(201);
    await page.evaluate(() => {
      window.showDirectoryPicker = async () => ({
        kind: "directory", name: "Project",
        queryPermission: async () => "granted"
      });
      window.prompt = () => ["C:", "Work", "Project"].join("\\\\");
    });
    await page.locator(".plugin-extension-button").click();
    await page.frameLocator(".plugin-extension-frame")
      .locator("[data-toolbox-toggle]").click();
    await page.getByRole("button", {
      name: /選取本地資料夾/
    }).click();
    const toolbox = page.locator(".plugin-agent-toolbox");
    await expect(toolbox.getByRole("status"))
      .toContainText("已取得所選資料夾授權");
    await pairInline(page, token);
    await expect(page.frameLocator(".plugin-extension-frame")
      .locator('[data-agent-status]')).toHaveText("已連線");
    // Trusted pairing dialogs close the dropdown on outside clicks.
    await page.frameLocator(".plugin-extension-frame")
      .locator("[data-toolbox-toggle]").click();
    await expect(toolbox.locator('[data-right="ps"]')).toBeVisible();
    await toolbox.locator('[data-right="ps"]').check();
    await expect.poll(() => page.evaluate(() =>
      window.__agentSent.some(item =>
        item.type === "bridge_register"))).toBe(true);
    let commandPreview = "";
    page.on("dialog", async dialog => {
      commandPreview = dialog.message();
      await dialog.accept();
    });
    await page.evaluate(() => window.__agentSocket.onmessage({
      data: JSON.stringify({
        type: "tool_call", requestId: crypto.randomUUID(),
        name: "cluster.powershell_request",
        args: { path: "Project", command: "Get-Location" }
      })
    }));
    await expect.poll(() => page.evaluate(() =>
      window.__agentSent.some(item => item.type === "tool_result" &&
        item.result?.approved === true))).toBe(true);
    expect(commandPreview).toContain("Get-Location");
    await toolbox.locator('[data-right="ps"]').uncheck();
    await page.evaluate(() => window.__agentSocket.onmessage({
      data: JSON.stringify({
        type: "tool_call", requestId: crypto.randomUUID(),
        name: "cluster.powershell_request",
        args: { path: "Project", command: "Get-Location" }
      })
    }));
    await expect.poll(() => page.evaluate(() =>
      window.__agentSent.filter(item =>
        item.type === "tool_result").length)).toBe(2);
    const results = await page.evaluate(() => window.__agentSent.filter(
      item => item.type === "tool_result").map(item =>
      item.result.approved));
    expect(results).toEqual([true, false]);
  });

test("PR14.8 explicit MCP read-only tool bridge returns metadata",
  async ({ page }) => {
    await page.goto("/");
    expect((await install(page)).approved).toBe(201);
    await page.locator(".plugin-extension-button").click();
    await pairInline(page, token);
    await expect(page.frameLocator(".plugin-extension-frame")
      .locator('[data-agent-status]')).toHaveText("已連線");
    await page.frameLocator(".plugin-extension-frame")
      .locator("[data-toolbox-toggle]").click();
    const box = page.locator(".plugin-agent-toolbox");
    await box.locator('[data-right="mcp"]').check();
    await expect.poll(() => page.evaluate(() =>
      window.__agentSent.some(item =>
        item.type === "bridge_register"))).toBe(true);
    await page.evaluate(() => window.__agentSocket.onmessage({
      data: JSON.stringify({
        type: "tool_call", requestId: crypto.randomUUID(),
        name: "cluster.list_files", args: {}
      })
    }));
    await expect.poll(() => page.evaluate(() =>
      window.__agentSent.some(item => item.type === "tool_result" &&
        Array.isArray(item.result?.files)))).toBe(true);
    await box.locator('[data-right="mcp"]').uncheck();
    await page.evaluate(() => window.__agentSocket.onmessage({
      data: JSON.stringify({
        type: "tool_call", requestId: crypto.randomUUID(),
        name: "cluster.list_files", args: {}
      })
    }));
    await expect.poll(() => page.evaluate(() =>
      window.__agentSent.filter(item =>
        item.type === "tool_result").length)).toBe(2);
    const denied = await page.evaluate(() => window.__agentSent.filter(
      item => item.type === "tool_result").at(-1).result.error);
    expect(denied).toBe("Tool access denied");
  });
