import { test, expect } from "@playwright/test";

test("PR23.1 dynamic host UI inventory registers and unregisters safely",
  async ({ page }) => {
    await page.goto("/");
    const outcome = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const { NativeUIDynamicIds } = await import(
        "/Implementation/main/native-ui-registration.js");
      const present = NativeUIDynamicIds.filter(id =>
        document.getElementById(id));
      await Promise.resolve();
      await Promise.resolve();
      const mapped = present.filter(id =>
        linkCore.uru.objects.has("UICO." + id));
      const candidate = NativeUIDynamicIds.find(id =>
        !document.getElementById(id));
      if (!candidate) {
        return { present, mapped, allPresent: true };
      }
      const pluginRoot = document.createElement("section");
      pluginRoot.dataset.clusterPluginUi = "plugin.demo.mock";
      const fake = document.createElement("button");
      fake.id = candidate;
      pluginRoot.appendChild(fake);
      document.body.appendChild(pluginRoot);
      await Promise.resolve();
      await Promise.resolve();
      const spoofRegistered = linkCore.uru.objects.has(
        "UICO." + candidate);
      pluginRoot.remove();
      const host = document.createElement("button");
      host.id = candidate;
      document.body.appendChild(host);
      await Promise.resolve();
      await Promise.resolve();
      const registered = linkCore.uru.objects.has("UICO." + candidate);
      host.remove();
      await Promise.resolve();
      await Promise.resolve();
      const removed = !linkCore.uru.objects.has("UICO." + candidate);
      return { present, mapped, allPresent: false,
        candidate, spoofRegistered, registered, removed };
    });
    expect(outcome.present.length).toBeGreaterThan(0);
    expect(outcome.mapped).toEqual(outcome.present);
    if (!outcome.allPresent) {
      expect(outcome.spoofRegistered).toBe(false);
      expect(outcome.registered).toBe(true);
      expect(outcome.removed).toBe(true);
    }
  }
);
