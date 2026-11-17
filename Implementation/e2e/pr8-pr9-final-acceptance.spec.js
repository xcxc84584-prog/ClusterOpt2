import { test, expect } from "@playwright/test";

test("PR9 current version is shown by original PSM UI", async ({ page }) => {
  await page.goto("/");
  const appVersion = await page.evaluate(() => Cluster.version());
  await expect(page.locator("#versionLabel")).toHaveText(appVersion);
  await page.locator("#explorerPowerShell").click();
  await expect(page.locator("#powershellManagerPane")).toBeVisible();
  await expect(page.locator(".psm-eyebrow")).toContainText(appVersion);
  await expect(page.locator("#nativePowerShellBtn")).toHaveCount(0);
  await expect(page.locator("#explorerPowerShell")).toHaveAttribute(
    "aria-pressed", "true");
});

test("PR9 generated CMD downloads only current ClusterOpt2 agent", async ({
  page
}) => {
  await page.goto("/");
  const version = await page.evaluate(() => Cluster.version());
  await page.locator("#explorerPowerShell").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-psm-action="download"]').click()
  ]);
  expect(download.suggestedFilename()).toBe(
    "ClusterOpt2-PLA-Setup-" + version + ".cmd");
  const fs = await import("node:fs/promises");
  const command = await fs.readFile(await download.path(), "utf8");
  expect(command).toContain("ClusterOpt2/main/Implementation/local-agent");
  expect(command).toContain("-ExpectedVersion \"" + version + "\"");
  expect(command).not.toContain("/ClusterOpt/main/");
});
