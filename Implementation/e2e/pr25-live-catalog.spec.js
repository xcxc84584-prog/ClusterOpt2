import { test, expect } from "@playwright/test";

async function openCatalog(page) {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await page.locator(".pm-tabs [role=tab]").nth(1).click();
}

test("PR25 live UI retains input and filters across pages", async ({page}) => {
  await openCatalog(page);
  const kind = page.locator(".pm-api-kind");
  const input = page.locator("#pluginApiSearch");
  const size = page.locator(".pm-api-size");
  await kind.selectOption("api");
  await size.selectOption("10");
  await expect(page.locator(".pm-api-table-row")).toHaveCount(10);
  await page.locator(".pm-api-pagination button").last().click();
  await expect(page.locator(".pm-api-pagination")).toContainText("2");
  await expect(kind).toHaveValue("api");
  await expect(size).toHaveValue("10");
  await page.locator(".pm-api-sort").selectOption("id");
  await page.locator(".pm-api-sort-order").selectOption("desc");
  await expect(page.locator(".pm-api-sort")).toHaveValue("id");
  await expect(page.locator(".pm-api-sort-order")).toHaveValue("desc");
  await input.fill("UICO");
  await expect(input).toHaveValue("UICO");
  await expect(page.locator(".pm-api-pagination")).toContainText("1");
  await kind.selectOption("protocol");
  await expect(input).toHaveValue("UICO");
  await input.fill("");
  await expect(page.locator(".pm-api-table-row").first()).toBeVisible();
});

test("PR25 selected descriptor is retrieved lazily from live source",
  async ({page}) => {
    await openCatalog(page);
    await page.locator("#pluginApiSearch").fill("UICO.describe");
    await page.locator(".pm-api-row-link").first().click();
    await expect(page.locator(".pm-contract-heading"))
      .toContainText("UICO.describe");
    await expect(page.locator(".pm-contract-json")).toBeVisible();
    await page.locator(".pm-contract-actions button").first().click();
    await expect(page.locator("#pluginApiSearch"))
      .toHaveValue("UICO.describe");
  }
);

test("PR25 full export ignores the current API filter", async ({page}) => {
  await openCatalog(page);
  await page.locator("#pluginApiSearch").fill("absent9876");
  await expect(page.locator(".pm-api-table-row")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", {name: /匯出完整 API 契約|Export all API contracts/})
    .click();
  const artifact = await download;
  expect(artifact.suggestedFilename())
    .toBe("ClusterOpt2-API-Contracts.json");
});

test("PR25 open catalog observes new URU API without UI reset",
  async ({page}) => {
    await openCatalog(page);
    const search=page.locator("#pluginApiSearch");
    await search.fill("liveprobe.run");
    await expect(page.locator(".pm-api-table-row")).toHaveCount(0);
    await page.evaluate(async () => {
      const { linkCore } = await import(
        "/Implementation/LinkCore/LinkCore.js");
      const id="LiveProbe";
      linkCore.register({
        id,
        authorization:{default:"Public"},
        receive:async()=>null,
        ocda:{
          Request:["run"],Response:["run"],
          UserAPI:["run"],AgentAPI:[],Property:[],
          Program:"Test",EHU:"LinkCore.OMU",Log:"LinkCore.OMU",
          APIDescriptors:[{
            apiVersion:1,owner:id,id:"liveprobe.run",action:"run",
            version:"1.0.0",visibility:"Public",sideEffect:"none",
            inputSchema:{type:"object"},
            outputSchema:{type:"object"}
          }]
        }
      });
    });
    await expect(page.locator(".pm-api-row-link")
      .filter({hasText:"liveprobe.run"})).toBeVisible({
      timeout: 7000
    });
    await expect(search).toHaveValue("liveprobe.run");
  });
