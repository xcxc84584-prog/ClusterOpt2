import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openManager(page, tab) {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await page.locator(".pm-tabs [role=tab]").nth(tab).click();
}

function storedZip(bytes) {
  const files = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30,
      offset + 30 + nameLength).toString("utf8");
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, bytes.subarray(start, start + size)
      .toString("utf8"));
    offset = start + size;
  }
  return files;
}

for (const width of [1200, 520]) {
  test("PR26 API category and search share one row at " + width,
    async ({page}) => {
      await page.setViewportSize({width, height:780});
      await openManager(page, 1);
      const toolbar=page.locator(".pm-api-toolbar");
      const selector=toolbar.locator("select");
      const search=toolbar.locator("input");
      await expect(selector).toHaveCount(1);
      await expect(search).toHaveCount(1);
      const a=await selector.boundingBox();
      const b=await search.boundingBox();
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(Math.abs(a.y - b.y)).toBeLessThan(3);
      expect(a.x + a.width).toBeLessThan(b.x);
      await expect(page.locator(".pm-api-table")).toBeVisible();
      await expect(page.locator(".pm-api-toolbar button")).toHaveCount(0);
    });
}

test("PR26 resource template ZIP includes live catalog and SDK",
  async ({page}) => {
    await openManager(page, 3);
    const downloadPromise=page.waitForEvent("download");
    await page.locator("#pluginTemplateDownload").click();
    const artifact=await downloadPromise;
    const bytes=await readFile(await artifact.path());
    const files=storedZip(bytes);
    const manifest=JSON.parse(files.get("plugin.json"));
    const catalog=JSON.parse(files.get("API-CATALOG.json"));
    expect(manifest.packageVersion).toBe(1);
    expect(manifest.provider.execution.isolation).toBe("worker");
    expect(manifest.rpcScopes).toEqual([]);
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.counts).toHaveProperty("api");
    expect(catalog.contracts).toHaveProperty("event");
    expect(files.get("types/cluster-plugin-sdk.d.ts"))
      .toContain("declare namespace ClusterSDK");
    expect(files.get("docs/MANIFEST.md"))
      .toContain("rpcScopes");
    expect(files.get("src/worker.js")).toContain("Cluster.handle");
    expect(files.get("README.md")).toContain("API-CATALOG.json");
  });
