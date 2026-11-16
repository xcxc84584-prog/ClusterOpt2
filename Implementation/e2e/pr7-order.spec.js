import { test, expect } from "@playwright/test";

test("PR7 Explorer drag reorders unattached editor documents", async ({ page }) => {
  await page.goto("/");
  await page.locator("#explorerToggle").click();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const entries = page.locator("#explorerTree .explorer-entry");
  await expect(entries).toHaveCount(2);
  const before = await entries.evaluateAll(nodes =>
    nodes.map(node => node.dataset.entryId));
  await entries.nth(1).dragTo(entries.nth(0));
  await expect.poll(async () => entries.evaluateAll(nodes =>
    nodes.map(node => node.dataset.entryId))).toEqual(
    [before[1], before[0]]);
});
