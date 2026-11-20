import { test, expect } from "@playwright/test";

async function openCatalog(page) {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await page.locator(".pm-tabs [role=tab]").nth(1).click();
}

test("PR26 API List has one-line search, selector and result table",
  async ({page}) => {
    await openCatalog(page);
    const toolbar=page.locator(".pm-api-toolbar");
    const kind=toolbar.locator(".pm-api-kind");
    const input=toolbar.locator("#pluginApiSearch");
    await expect(toolbar.locator("select")).toHaveCount(1);
    await expect(toolbar.locator("input")).toHaveCount(1);
    await expect(toolbar.locator("button")).toHaveCount(0);
    await expect(page.locator(".pm-api-table")).toBeVisible();
    await expect(page.locator(".pm-api-table-row").first())
      .toBeVisible();
    await kind.selectOption("event");
    await input.fill("WorkerSDK.SessionChange");
    await expect(input).toHaveValue("WorkerSDK.SessionChange");
    await expect(page.locator(".pm-api-row-link"))
      .toContainText("WorkerSDK.SessionChange");
    await expect(page.locator(".pm-api-pagination")).toBeVisible();
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

test("PR26 complete API export lives in Resources only",
  async ({page}) => {
    await openCatalog(page);
    await expect(page.getByRole("button",{
      name:/匯出完整 API 契約|Export all API contracts/
    })).toHaveCount(0);
    await page.locator(".pm-tabs [role=tab]").nth(3).click();
    const download=page.waitForEvent("download");
    await page.getByRole("button",{
      name:/匯出完整 API 契約|Export all API contracts/
    }).click();
    expect((await download).suggestedFilename())
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
