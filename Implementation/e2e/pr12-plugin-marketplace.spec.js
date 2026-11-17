import {readFile} from "node:fs/promises";
import {test, expect} from "@playwright/test";

async function openResources(page) {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await expect(page.locator("#pluginWindow")).toBeVisible();
  await page.locator("#pluginManagerPages .pm-tab").nth(3).click();
  await expect(page.locator("#pluginResourceSearch")).toBeVisible();
}

test("PR12 resources show searchable downloadable packages, not paths", async ({page}) => {
  await openResources(page);
  await expect(page.locator(".pm-market-card").filter({
    has: page.locator('a[download="multilang-highlighter.js"]')
  })).toHaveCount(1);
  await expect(page.locator("#pluginAgentDownload")).toHaveCount(1);
  await expect(page.locator("a.pm-market-download")).toHaveAttribute(
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
  await page.locator(".pm-market-card").filter({
    has: page.locator('a[download="multilang-highlighter.js"]')
  }).getByRole("button", {name: /裝載|Mount/}).click();
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
  await page.locator(".pm-market-card").filter({
    has: page.locator('a[download="multilang-highlighter.js"]')
  }).getByRole("button", {name: /裝載|Mount/}).click();
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

test("PR12 Close No directly closes an unsaved tab", async ({page}) => {
  await page.goto("/");
  await page.keyboard.press("Control+n");
  await expect(page.locator("#tabs .tab:not([data-tab-kind=tool])"))
    .toHaveCount(1);
  await page.locator("#tabs .tab .close").first().click();
  const modal = page.locator(".save-close-dialog");
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("heading")).toContainText(
    /是否存儲|Save changes/);
  await modal.locator(".save-close-no").click();
  await expect(page.locator("#tabs .tab:not([data-tab-kind=tool])"))
    .toHaveCount(0);
});

test("PR12 Close Yes saves a new file before removing its tab", async ({page}) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.__pr12Written = [];
    window.showSaveFilePicker = async () => ({
      name: "new.txt",
      async getFile() {
        return new Blob([], {type: "text/plain"});
      },
      async createWritable() {
        return {
          async write(chunk) {
            window.__pr12Written.push(chunk.byteLength ?? 0);
          },
          async close() {}
        };
      }
    });
  });
  await page.keyboard.press("Control+n");
  await expect(page.locator("#tabs .tab:not([data-tab-kind=tool])"))
    .toHaveCount(1);
  await page.locator("#tabs .tab .close").first().click();
  const modal = page.locator(".save-close-dialog");
  await expect(modal).toBeVisible();
  await modal.locator(".save-close-yes").click();
  await expect(page.locator("#tabs .tab:not([data-tab-kind=tool])"))
    .toHaveCount(0);
  expect(await page.evaluate(() =>
    Array.isArray(window.__pr12Written))).toBeTruthy();
});
