import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const makeHandle = (name, initial = "") => {
      let content = initial;
      let diskRevision = 1000;
      return {
        name,
        async isSameEntry(other) { return this === other; },
        async getFile() {
          return new File([content], name, {
            type: "text/plain", lastModified: diskRevision
          });
        },
        async createWritable() {
          const chunks = [];
          return {
            async write(chunk) { chunks.push(chunk); },
            async close() {
              content = await new Blob(chunks).text();
              diskRevision++;
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
  const background = await page.locator("header.toolbar").evaluate(element =>
    getComputedStyle(element).backgroundColor);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  await expect(page.locator(
    'link[href$="clusteropt-legacy.css"]')).toHaveCount(1);
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

test("PR2 palette updates global tokens and survives reload", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#paletteBtn").click();

  await expect(page.locator("#paletteDialog")).toBeVisible();
  await page.locator("#palettePicker").fill("#123456");
  await expect(page.locator("#paletteHex")).toHaveText("#123456");
  await expect.poll(async () => page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--ui-background")
  )).toBe("rgb(18, 52, 86)");

  await page.locator("#paletteDone").click();
  await page.reload();
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#paletteBtn").click();

  await expect(page.locator("#palettePicker")).toHaveValue("#123456");
  await expect(page.locator("#paletteMode")).toHaveText("DARK");
});

test("PR2 RGB channels and endpoints share the same global property", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#paletteBtn").click();

  await page.locator("#paletteLight").click();
  await expect(page.locator("#paletteHex")).toHaveText("#FFFFFF");
  await expect(page.locator("#paletteMode")).toHaveText("LIGHT");

  await page.locator('[data-rgb="0"]').fill("12");
  await page.locator('[data-rgb="0"]').dispatchEvent("change");
  await expect(page.locator("#paletteHex")).toHaveText("#0CFFFF");

  const props = await page.evaluate(() => window.Cluster.propertylist());
  expect(props.some(item => item.name === "UI_COLOR")).toBe(true);
  await page.locator("#paletteDark").click();
  await expect(page.locator("#paletteHex")).toHaveText("#000000");
});

test("PR2 invalid RGB is rejected and original controls are restored", async ({ page }) => {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#paletteBtn").click();

  await page.locator('[data-rgb="0"]').fill("-8");
  await page.locator('[data-rgb="0"]').dispatchEvent("change");
  await expect(page.locator("#paletteHint")).toContainText("RGB");
  await expect(page.locator('[data-rgb="0"]')).toHaveValue("0");
  await expect(page.locator("#paletteHex")).toHaveText("#000000");
});

test("PR3 switches file menu, status, tabs and palette to English", async ({ page }) => {
	await page.goto("/");
	await page.locator("#menuBtn").click();
	await page.locator("#toolBtn").click();
	await page.locator("#languageBtn").click();
	await page.locator('[data-locale="en"]').click();

	await expect(page.locator("#menuBtn")).toHaveText("File⌄");
	await expect(page.locator("#status")).toHaveText("Ready");
	await expect(page.locator("#emptyHint")).toContainText("Choose File");
	await expect(page.locator("#editor")).toHaveAttribute("aria-label", "Text editor");
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(page.locator("#menu"))
		.toHaveAttribute("aria-label", "File menu");
	await expect(page.locator("#toolOptions"))
		.toHaveAttribute("aria-label", "Tools");

	await page.locator("#menuBtn").click();
	await expect(page.locator("#newFile")).toHaveText("New File");
	await expect(page.locator("#saveAsFile")).toHaveText("Save As");
	await page.locator("#toolBtn").click();
	await expect(page.locator("#paletteBtn")).toHaveText("Interface Palette ›");
	await page.locator("#paletteBtn").click();
	await expect(page.locator("#paletteTitle")).toHaveText("Interface Palette");
	await expect(page.locator("#paletteDark")).toHaveText("Black Endpoint");
});

test("PR3 language persists across reload and can return to Chinese", async ({ page }) => {
	await page.goto("/");
	await page.locator("#menuBtn").click();
	await page.locator("#toolBtn").click();
	await page.locator("#languageBtn").click();
	await page.locator('[data-locale="en"]').click();
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
	await expect(page.locator("#status")).toHaveText("Ready");
	await page.locator("#menuBtn").click();
	await page.locator("#toolBtn").click();
	await page.locator("#languageBtn").click();
	await expect(page.locator('[data-locale="en"]'))
		.toHaveAttribute("aria-pressed", "true");
	await page.locator('[data-locale="zh-Hant"]').click();
	await expect(page.locator("#status")).toHaveText("就緒");
	await expect(page.locator("#menuBtn")).toHaveText("檔案⌄");
	await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
});

test("PR3 changing locale does not lose unsaved editor contents", async ({ page }) => {
	await page.goto("/");
	await page.locator("#menuBtn").click();
	await page.locator("#newFile").click();
	await page.locator("#editor").fill("draft / 未儲存");
	await page.locator("#menuBtn").click();
	await page.locator("#toolBtn").click();
	await page.locator("#languageBtn").click();
	await page.locator('[data-locale="en"]').click();
	await expect(page.locator("#editor")).toHaveValue("draft / 未儲存");
	await expect(page.locator("#status")).toHaveText("Unsaved changes");
	await expect(page.locator("#statusLamp")).toHaveClass(/yellow/);
	const language = await page.evaluate(() =>
		window.Cluster.propertylist().find(item => item.name === "Language"));
	expect(language).toBeTruthy();
});
