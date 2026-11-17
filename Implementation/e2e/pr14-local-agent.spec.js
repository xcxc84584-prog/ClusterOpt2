import { test, expect } from "@playwright/test";

const providerId = "cluster.ai-agent-mcp";
const token = "b".repeat(64);

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
      consented: true, approvedPermissions: ["network.request", "local-agent.pair"]
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
    await frame.locator('[data-agent-action="pair"]').click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="password"]').fill(token);
    await dialog.getByRole("button", { name: "連線" }).click();
    await expect(frame.locator("[data-agent-status]"))
      .toHaveText("已連線");
    await frame.locator('[data-agent-action="ping"]').click();
    await expect(frame.locator("[data-agent-error]")).toBeEmpty();
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
    await frame.locator('[data-agent-action="pair"]').click();
    await page.locator("dialog[open] input").fill(token);
    await page.locator("dialog[open] button[type=submit]").click();
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
