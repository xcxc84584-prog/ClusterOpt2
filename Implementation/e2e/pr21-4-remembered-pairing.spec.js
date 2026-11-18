import { test, expect } from "@playwright/test";

test("PR21.4 old Cluster saved token migrates to AES-GCM vault",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const oldKey = "cluster-terminal-remembered-token-v1";
      const oldPort = "cluster-terminal-remembered-port-v1";
      localStorage.setItem(oldKey, "a".repeat(64));
      localStorage.setItem(oldPort, "43881");
      const { TrustedPairingVault } = await import(
        "/Implementation/LinkCore/TrustedPairingVault.js");
      const vault = new TrustedPairingVault(window);
      const credential = await vault.load();
      const key = await vault.get("key");
      const ciphertext = await vault.get("pair");
      return {
        token: credential?.token,
        port: credential?.port,
        oldTokenRemoved: localStorage.getItem(oldKey) === null,
        oldPortRemoved: localStorage.getItem(oldPort) === null,
        nonextractable: key.extractable === false,
        protected: !JSON.stringify(ciphertext).includes("a".repeat(64)),
        loadedAgain: (await vault.load())?.token
      };
    });
    expect(result).toEqual({
      token: "a".repeat(64), port: 43881,
      oldTokenRemoved: true, oldPortRemoved: true,
      nonextractable: true, protected: true,
      loadedAgain: "a".repeat(64)
    });
  });

test("PR21.4 encrypted remembered token shows Start AI Agent without sandbox secret",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const { TrustedPairingVault } = await import(
        "/Implementation/LinkCore/TrustedPairingVault.js");
      await new TrustedPairingVault(window).save({
        token: "b".repeat(64), port: 43881
      });
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const files = {};
      for (const name of ["plugin.json", "worker.js", "index.html",
        "README.md", "locales/en.json", "locales/zh-Hant.json"]) {
        const response = await fetch(
          "/Implementation/plugins/ai-agent-mcp/" + name);
        const bytes = new Uint8Array(await response.arrayBuffer());
        files[name] = btoa(String.fromCharCode(...bytes));
      }
      const manifestText = new TextDecoder().decode(
        Uint8Array.from(atob(files["plugin.json"]),
          char => char.charCodeAt(0)));
      const response = await linkCore.pluginHostInstaller.install({
        format: "cluster-plugin-folder", formatVersion: 1,
        manifestText, files
      }, { consented: true, approvedPermissions: [
        "network.request", "local-agent.pair",
        "model.configure", "model.task", "shell.execute", "mcp.read"
      ] });
      if (response.status !== 201) throw Error("Fixture failed");
    });
    await page.locator(".plugin-extension-button").click();
    const frame = page.frameLocator(".plugin-extension-frame");
    await expect(frame.locator("[data-saved-connect]")).toBeVisible();
    await expect(frame.locator("#caiTrustedPairSlot")).toBeHidden();
    await expect(page.locator(".plugin-agent-inline-pair")).toBeHidden();
    await expect(frame.locator("#caiConnectGuide")).toHaveCount(0);
    const isolated = await page.evaluate(() => {
      const target = document.querySelector(".plugin-extension-frame");
      const html = target.getAttribute("srcdoc");
      return !html.includes("b".repeat(64));
    });
    expect(isolated).toBe(true);
  });
