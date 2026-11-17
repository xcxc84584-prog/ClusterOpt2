import {readFile} from "node:fs/promises";
import {test, expect} from "@playwright/test";

async function openResources(page) {
  await page.goto("/");
  await page.locator("#pluginBtn").click();
  await expect(page.locator("#pluginWindow")).toBeVisible();
  await page.locator("#pluginManagerPages .pm-tab").nth(3).click();
  await expect(page.locator("#pluginResourceSearch")).toBeVisible();
}

test("PR12 resources show searchable downloadable packages, not paths", async ({page}) => {
  await openResources(page);
  await expect(page.locator(".pm-market-card")).toHaveCount(1);
  await expect(page.locator(".pm-market-download")).toHaveAttribute(
    "download", "multilang-highlighter.js");
  await expect(page.locator(".pm-sample-editor")).toHaveCount(0);
  await expect(page.locator(".pm-sample-preview")).toHaveCount(0);
  await expect(page.locator(".pm-resource-card input[type=text]")).toHaveCount(0);
  await page.locator("#pluginResourceSearch").fill("missing-provider");
  await expect(page.locator(".pm-market-card")).toHaveCount(0);
  await page.locator("#pluginResourceSearch").fill("syntax");
  await expect(page.locator(".pm-market-card")).toHaveCount(1);
});

test("PR12 local chooser mounts only an exact reviewed download", async ({page}) => {
  await openResources(page);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator(".pm-market-actions button").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "multilang-highlighter.js",
    mimeType: "text/javascript",
    buffer: await readFile("Implementation/plugins/multilang-highlighter.js")
  });
  await expect(page.locator(".pm-market-status")).toContainText(
    /HubUnit|mounted|裝載/);
  const provider = await page.evaluate(async () => {
    const {linkCore} = await import(
      "/Implementation/LinkCore/LinkCore.js");
    return Boolean(linkCore.uru.getProvider(
      "cluster.sample.multilang-highlighter"));
  });
  expect(provider).toBeTruthy();
});

test("PR12 altered local JavaScript is blocked without execution", async ({page}) => {
  await openResources(page);
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator(".pm-market-actions button").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "multilang-highlighter.js",
    mimeType: "text/javascript",
    buffer: Buffer.from("window.__unsafeExecuted = true;")
  });
  await expect(page.locator(".pm-market-status")).toContainText(
    /403|不一致|differs/);
  const check = await page.evaluate(async () => {
    const {linkCore} = await import(
      "/Implementation/LinkCore/LinkCore.js");
    return {
      ran: window.__unsafeExecuted === true,
      registered: Boolean(linkCore.uru.getProvider(
        "cluster.sample.multilang-highlighter"))
    };
  });
  expect(check).toEqual({ran: false, registered: false});
});
