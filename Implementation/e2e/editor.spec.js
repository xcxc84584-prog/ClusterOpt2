import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const makeHandle = (name, initial = "") => {
      let content = initial;
      return {
        name,
        async isSameEntry(other) { return this === other; },
        async getFile() {
          return new File([content], name, { type: "text/plain" });
        },
        async createWritable() {
          const chunks = [];
          return {
            async write(chunk) { chunks.push(chunk); },
            async close() {
              content = await new Blob(chunks).text();
              window.__savedText = content;
            },
            async abort() { chunks.length = 0; }
          };
        }
      };
    };
    const oldHandle = makeHandle("example.txt", "hello\nline two");
    window.showOpenFilePicker = async () => [oldHandle];
    window.showSaveFilePicker = async () => makeHandle("new.txt");
  });
});

test("Original ClusterOpt file menu and theme are present", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#menuBtn")).toBeVisible();
  await expect(page.locator(".brand strong")).toHaveText("Cluster");
  const background = await page.locator("header").evaluate(element =>
    getComputedStyle(element).backgroundColor);
  expect(background).toBe("rgb(32, 33, 39)");
  await page.locator("#menuBtn").click();
  await expect(page.locator("#openFile")).toBeVisible();
});

test("Open, edit, save and close through PR1 UI", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#openFile").click();
  await expect(page.locator("#tabs .tab")).toHaveCount(1);
  await expect(page.locator("#editor")).toHaveValue("hello\nline two");
  await expect(page.locator("#gutter")).toContainText("2");

  await page.locator("#editor").fill("updated\ncontents");
  await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
  await page.locator("#menuBtn").click();
  await page.locator("#saveFile").click();

  await expect(page.locator("#statusLamp")).toHaveClass(/green/);
  await expect.poll(async () =>
    page.evaluate(() => window.__savedText)).toBe("updated\ncontents");

  await page.locator("#menuBtn").click();
  await page.locator("#closeFile").click();
  await expect(page.locator("#tabs .tab")).toHaveCount(0);
});

test("Different tabs preserve individual unsaved text", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  await page.locator("#editor").fill("first draft");
  await page.locator("#menuBtn").click();
  await page.locator("#openFile").click();
  await expect(page.locator("#tabs .tab")).toHaveCount(2);
  await page.locator("#tabs .tab").first().click();
  await expect(page.locator("#editor")).toHaveValue("first draft");
  await page.locator("#tabs .tab").last().click();
  await expect(page.locator("#editor")).toHaveValue("hello\nline two");
});
