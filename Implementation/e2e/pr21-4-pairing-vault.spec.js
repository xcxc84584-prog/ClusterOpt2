import { test, expect } from "@playwright/test";

test("PR21.4 remembered pairing encrypts credentials and survives reload",
  async ({ page }) => {
    await page.goto("/");
    const first = await page.evaluate(async () => {
      const { TrustedPairingVault } = await import(
        "/Implementation/LinkCore/TrustedPairingVault.js");
      const vault = new TrustedPairingVault(window);
      const token = "a".repeat(64);
      await vault.save({ token, port: 43881 });
      const raw = await vault.get("pair");
      const loaded = await vault.load();
      return {
        encrypted: Array.isArray(raw.payload) &&
          !JSON.stringify(raw).includes(token),
        keyExtractable: (await vault.get("key")).extractable,
        port: loaded.port, matched: loaded.token === token,
        leaked: Object.values(localStorage).some(value =>
          String(value).includes(token))
      };
    });
    expect(first).toEqual({
      encrypted: true, keyExtractable: false,
      port: 43881, matched: true, leaked: false
    });
    await page.reload();
    const again = await page.evaluate(async () => {
      const { TrustedPairingVault } = await import(
        "/Implementation/LinkCore/TrustedPairingVault.js");
      const vault = new TrustedPairingVault(window);
      const credential = await vault.load();
      await vault.clear();
      return {
        loaded: credential?.token === "a".repeat(64),
        removed: (await vault.load()) === null
      };
    });
    expect(again).toEqual({ loaded: true, removed: true });
  });

test("PR21.4 previous Cluster localStorage pairing migrates and clears",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { TrustedPairingVault } = await import(
        "/Implementation/LinkCore/TrustedPairingVault.js");
      localStorage.setItem("cluster-terminal-remembered-token-v1",
        "b".repeat(64));
      localStorage.setItem("cluster-terminal-remembered-port-v1", "43882");
      const vault = new TrustedPairingVault(window);
      const imported = await vault.load();
      const cleared = !localStorage.getItem(
        "cluster-terminal-remembered-token-v1");
      await vault.clear();
      return {
        imported: imported?.token === "b".repeat(64) &&
          imported?.port === 43882,
        cleared
      };
    });
    expect(result).toEqual({ imported: true, cleared: true });
  });


test("PR21.4 saved token activates host-only reconnect, not iframe credential",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const { TrustedPairingVault } = await import(
        "/Implementation/LinkCore/TrustedPairingVault.js");
      await new TrustedPairingVault(window).save({
        token: "c".repeat(64), port: 43881
      });
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const files = {};
      const names = [
        "plugin.json", "worker.js", "index.html", "README.md",
        "locales/en.json", "locales/zh-Hant.json"
      ];
      for (const name of names) {
        const response = await fetch(
          "/Implementation/plugins/ai-agent-mcp/" + name);
        files[name] = btoa(String.fromCharCode(
          ...new Uint8Array(await response.arrayBuffer())));
      }
      const manifestText = new TextDecoder().decode(
        Uint8Array.from(atob(files["plugin.json"]), c => c.charCodeAt(0)));
      const response = await linkCore.pluginHostInstaller.install({
        format: "cluster-plugin-folder",
        formatVersion: 1, manifestText, files
      }, { consented: true, approvedPermissions: [
        "network.request", "local-agent.pair",
        "model.configure", "model.task",
        "shell.execute", "mcp.read"
      ] });
      if (response.status !== 201) throw Error("Fixture mount denied");
    });
    await page.locator(".plugin-extension-button").click();
    const frame = page.frameLocator(".plugin-extension-frame");
    await expect(frame.locator("[data-saved-connect]")).toBeVisible();
    await expect(page.locator(".plugin-agent-inline-pair")).toBeHidden();
    const alert = page.waitForEvent("dialog");
    await frame.locator("[data-saved-connect]").click();
    const dialog = await alert;
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Token");
    await dialog.dismiss();
    await expect(frame.locator("[data-saved-connect]")).toBeVisible();
    expect(await frame.locator("input[type=password]").count()).toBe(0);
    await page.evaluate(async () => {
      const { TrustedPairingVault } = await import(
        "/Implementation/LinkCore/TrustedPairingVault.js");
      await new TrustedPairingVault(window).clear();
    });
  });
