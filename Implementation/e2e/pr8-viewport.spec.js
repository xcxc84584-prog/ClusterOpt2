import { test, expect } from "@playwright/test";

test("PR8 guides use real line breaks and follow scroll position", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const editor = page.locator("#editor");
  const lines = Array.from({ length: 160 },
    (_, index) => "\tcolumn_" + index).join("\n");
  await editor.fill(lines);
  await expect(page.locator("#meterFill"))
    .toHaveAttribute("data-status", "yellow");
  await expect(page.locator("#tabGuide")).toContainText("┊");
  await editor.evaluate(node => {
    node.scrollTop = 800;
    node.dispatchEvent(new Event("scroll"));
  });
  await expect.poll(() => page.locator("#tabGuide").evaluate(node =>
    node.textContent.includes("\n"))).toBe(true);
  const metrics = await page.evaluate(() => ({
    scroll: document.querySelector("#editor").scrollTop,
    guideTop: parseFloat(document.querySelector("#tabGuide").style.top),
    font: getComputedStyle(document.querySelector("#editor")).font
  }));
  expect(metrics.scroll).toBeGreaterThan(0);
  expect(Number.isFinite(metrics.guideTop)).toBe(true);
  expect(metrics.font.length).toBeGreaterThan(0);
});

test("PR6 and PR7 VTE is a detached sandbox", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    VTE.C("a");
    VTE.C("b");
    const passed = await VTE.A("a", "b", "list", { id: 1 });
    const missing = await VTE.A("a", "missing", "list");
    return {
      passed, missing,
      hasFailure: VTE.log().some(x => x.kind === "EHU" &&
        x.status === 404)
    };
  });
  expect(result.passed.ok).toBe(true);
  expect(result.missing.status).toBe(404);
  expect(result.hasFailure).toBe(true);
  await expect(page.locator("#tabs .tab")).toHaveCount(0);
});
