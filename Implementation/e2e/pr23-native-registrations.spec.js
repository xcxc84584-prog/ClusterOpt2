import { test, expect } from "@playwright/test";

test("PR23.6 86 audited native UI surfaces enter URU and API List",
  async ({ page }) => {
    await page.goto("/");
    const info = await page.evaluate(async () => {
      const { NativeUIStaticIds, NativeUIDynamicIds } = await import(
        "/Implementation/main/native-ui-registration.js");
      const ids = window.Cluster.objectlist();
      const native = ids.filter(id => id.startsWith("UICO."));
      const ui = window.Cluster.api;
      return {
        audited: NativeUIStaticIds.length,
        native: native.length,
        staticRegistered: NativeUIStaticIds.every(id =>
          native.includes("UICO." + id)),
        knownNative: native.every(id => [...NativeUIStaticIds,
          ...NativeUIDynamicIds].includes(id.slice(5))),
        editorRegistered: native.includes("UICO.editor"),
        windowRegistered: native.includes("UICO.pluginWindow"),
        duplicateIds: native.length - new Set(native).size,
        apiPresent: Boolean(ui)
      };
    });
    expect(info.audited).toBe(86);
    expect(info.native).toBeGreaterThanOrEqual(86);
    expect(info.staticRegistered).toBe(true);
    expect(info.knownNative).toBe(true);
    expect(info.editorRegistered).toBe(true);
    expect(info.windowRegistered).toBe(true);
    expect(info.duplicateIds).toBe(0);
    expect(info.apiPresent).toBe(true);
  }
);
