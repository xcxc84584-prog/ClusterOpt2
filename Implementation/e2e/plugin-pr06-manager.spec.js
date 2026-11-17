import { test, expect } from "@playwright/test";

test("PR06.08 four separate Plugin Manager pages in original tool tab",
  async ({ page }) => {
    await page.goto("/");
    await page.locator("#menuBtn").click();
    await page.locator("#toolBtn").click();
    await page.locator("#pluginBtn").click();
    await expect(page.locator("#pluginManagerPages")).toBeVisible();
    const nav = page.locator(".pm-tabs [role=tab]");
    await expect(nav).toHaveCount(6);
    await expect(page.locator(".pm-page")).toBeVisible();
    await nav.nth(1).click();
    await expect(nav.nth(1)).toHaveAttribute("aria-selected","true");
    await nav.nth(2).click();
    await expect(nav.nth(2)).toHaveAttribute("aria-selected","true");
    await nav.nth(3).click();
    await expect(nav.nth(3)).toHaveAttribute("aria-selected","true");
    await page.locator("#pluginToolToggle").click();
    await expect(page.locator("#pluginLegacySettings")).toBeVisible();
    await page.locator("#pluginToolToggle").click();
    await expect(page.locator("#pluginManagerPages")).toBeVisible();
    await expect(page.locator("#pluginLegacySettings")).toBeHidden();
  });

test("PR06.08 permission management is fail-closed, no direct Grant",
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      linkCore.register({
        id: "PreviewOwner", receive: async () => null,
        ocda: { Request: ["run"], Response: [],
          UserAPI: ["run"], AgentAPI: [], Property: [],
          Program: {}, EHU: [], Log: [] }
      });
      linkCore.registerProvider("PreviewOwner", {
        manifestVersion: 1, providerId: "preview.plugin",
        objectId: "PreviewOwner", provides: [{
          service: "test.preview", action: "run",
          version: "1.0.0", inputSchema: { type: "object" },
          outputSchema: { type: "object" }
        }], requires: [], permissions: ["document.slice.read"],
        execution: { isolation: "worker", concurrency: "serial" }
      });
    });
    await page.locator("#menuBtn").click();
    await page.locator("#toolBtn").click();
    await page.locator("#pluginBtn").click();
    await page.locator(".pm-tabs [role=tab]").nth(1).click();
    await expect(page.locator(".pm-page"))
      .toContainText("preview.plugin");
    await page.locator(".pm-tabs [role=tab]").nth(2).click();
    await expect(page.locator(".pm-page"))
      .toContainText("document.slice.read");
    await page.getByRole("button", { name: "授予" }).click();
    await expect(page.locator(".plugin-consent-dialog")).toBeVisible();
    await page.locator(".plugin-consent-dialog").getByRole("button",
      { name: "拒絕" }).click();
    await expect(page.locator(".plugin-consent-dialog")).toBeHidden();
    const denied = await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      return linkCore.checkPluginPermission(
        "preview.plugin", "document.slice.read");
    });
    expect(denied).toBe(false);
    await page.getByRole("button", { name: "授予" }).click();
    await page.locator(".plugin-consent-dialog").getByRole("button",
      { name: "同意此權限" }).click();
    await expect(page.getByRole("button", { name: "撤銷" }))
      .toBeVisible();
    await page.getByRole("button", { name: "撤銷" }).click();
    await expect(page.getByRole("button", { name: "授予" }))
      .toBeVisible();
    await page.locator(".pm-tabs [role=tab]").nth(3).click();
    await expect(page.locator(".pm-page"))
      .toContainText("test.preview");
  });
