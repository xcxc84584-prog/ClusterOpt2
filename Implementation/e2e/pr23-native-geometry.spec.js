import { test, expect } from "@playwright/test";

test("PR23 native UISP geometry follows live DOM without mutation API",
  async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      linkCore.register({
        id: "GeometryProbe", receive: async () => null
      });
      const read = () => linkCore.request("GeometryProbe",
        "UICO.menuBtn", "getState", {}, { origin: "user" });
      const before = await read();
      const editor = document.getElementById("menuBtn");
      const originalWidth = editor.style.width;
      editor.style.width = "333px";
      const after = await read();
      editor.style.width = originalWidth;
      return {
        before: before.value?.geometry.width,
        after: after.value?.geometry.width,
        statusBefore: before.status, statusAfter: after.status,
        authorizedRead: after.ok,
        history: linkCore.omu.snapshot().dependencies.some(
          entry => entry.link === "GeometryProbe->UICO.menuBtn")
      };
    });
    expect(result.statusBefore).toBe(200);
    expect(result.statusAfter).toBe(200);
    expect(result.authorizedRead).toBe(true);
    expect(result.after).toBe(333);
    expect(result.after).not.toBe(result.before);
    expect(result.history).toBe(true);
  }
);
