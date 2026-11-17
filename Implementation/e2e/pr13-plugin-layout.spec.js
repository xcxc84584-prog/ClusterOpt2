import { test, expect } from "@playwright/test";

async function openTab(page, index) {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await page.locator(".pm-tabs [role=tab]").nth(index).click();
}

test("PR13 resources separate search, chooser, and catalogue cards",
  async ({ page }) => {
    await openTab(page, 3);
    const result = await page.locator(".pm-resource-downloads").evaluate(
      pane => {
        const box = selector =>
          pane.querySelector(selector).getBoundingClientRect();
        const search = box("#pluginResourceSearch");
        const chooser = box(".pm-resource-local");
        const cards = box(".pm-resource-cards");
        const first = box(".pm-market-card");
        const second = pane.querySelectorAll(".pm-market-card")[1]
          .getBoundingClientRect();
        return {
          searchGap: chooser.top - search.bottom,
          chooserGap: cards.top - chooser.bottom,
          cardGap: second.top - first.bottom,
          cardHeight: first.height,
          searchHeight: search.height
        };
      });
    expect(result.searchGap).toBeGreaterThanOrEqual(8);
    expect(result.chooserGap).toBeGreaterThanOrEqual(8);
    expect(result.cardGap).toBeGreaterThanOrEqual(10);
    expect(result.searchHeight).toBeGreaterThanOrEqual(36);
    expect(result.cardHeight).toBeGreaterThan(60);
  });

test("PR13 API heading and search do not collide with table columns",
  async ({ page }) => {
    // Horizontal scrolling is needed only when the host is narrow.
    await page.setViewportSize({ width: 800, height: 720 });
    await openTab(page, 1);
    const result = await page.locator(".pm-api-browser").evaluate(
      browser => {
        const input = browser.querySelector(".pm-api-search")
          .getBoundingClientRect();
        const wrap = browser.querySelector(".pm-api-table-wrap")
          .getBoundingClientRect();
        const table = browser.querySelector(".pm-api-table");
        const first = table.querySelector("tbody td:first-child")
          .getBoundingClientRect();
        return {
          searchGap: wrap.top - input.bottom,
          firstWidth: first.width,
          horizontalScrollable: table.scrollWidth >
            browser.querySelector(".pm-api-table-wrap").clientWidth
        };
      });
    expect(result.searchGap).toBeGreaterThanOrEqual(10);
    expect(result.firstWidth).toBeGreaterThanOrEqual(95);
    expect(result.horizontalScrollable).toBe(true);
  });
