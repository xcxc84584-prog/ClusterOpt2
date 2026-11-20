import { test, expect } from "@playwright/test";

async function openManager(page) {
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
}

test("sketch layout has four tabs and persistent scrollable sidebar",
  async ({page})=>{
    await openManager(page);
    await expect(page.locator(".pm-shell")).toBeVisible();
    await expect(page.locator(".pm-tabs [role=tab]")).toHaveCount(4);
    await expect(page.locator(".pm-sidebar")).toBeVisible();
    await expect(page.locator(".pm-page")).toBeVisible();
    const style=await page.locator(".pm-page").evaluate(node=>
      getComputedStyle(node).overflowY);
    expect(style).toBe("auto");
    await page.locator(".pm-tabs [role=tab]").nth(3).click();
    await expect(page.locator("#pluginLegacySettings")).toBeVisible();
    await expect(page.locator("#pluginMaxMiB")).toBeVisible();
    await expect(page.locator(".pm-resources")).toBeVisible();
    await expect(page.locator(".pm-resource-pane")).toHaveCount(2);
  });

test("live Provider manifest publishes inspectable API contract",
  async ({page})=>{
    await openManager(page);
    await page.evaluate(async()=>{
      const {linkCore}=await import("/Implementation/LinkCore/LinkCore.js");
      linkCore.register({id:"LayoutOwner",receive:async()=>null,
        ocda:{Request:["run"],Response:[],UserAPI:["run"],
          AgentAPI:[],Property:[],Program:{},EHU:[],Log:[]}});
      const result=linkCore.registerProvider("LayoutOwner",{
        manifestVersion:1,providerId:"example.plugin",objectId:"LayoutOwner",
        provides:[{service:"example.render",action:"run",version:"1.0.0",
          inputSchema:{type:"object",properties:{text:{type:"string"}}},
          outputSchema:{type:"object"}}],
        requires:[],permissions:["document.slice.read"],
        execution:{isolation:"worker",concurrency:"serial"}});
      if(!result.ok)throw Error(JSON.stringify(result));
    });
    // Switching tabs refreshes the live provider registry.
    await page.locator(".pm-tabs [role=tab]").nth(1).click();
    await page.locator(".pm-tabs [role=tab]").nth(0).click();
    await expect(page.locator(".pm-provider")).toHaveCount(1);
    await expect(page.locator(".pm-permission-controls input"))
      .toBeChecked();
    await page.locator(".pm-tabs [role=tab]").nth(1).click();
    await page.locator(".pm-api-kind").selectOption("service");
    await expect(page.locator(".pm-api-row-link")
      .filter({hasText:"example.render"})).toBeVisible();
    await page.locator(".pm-api-row-link")
      .filter({hasText:"example.render"}).click();
    await expect(page.locator(".pm-contract-json")).toContainText(
      '"text"');
    await expect(page.locator(".pm-contract-json")).toContainText(
      '"inputSchema"');
  });

test("language switching updates plugin tab labels",async ({page})=>{
  await openManager(page);
  await page.evaluate(async()=>{
    const {linkCore}=await import("/Implementation/LinkCore/LinkCore.js");
    linkCore.edpmu.update("Language","en");
  });
  await page.locator(".pm-tabs [role=tab]").nth(1).click();
  await page.locator(".pm-tabs [role=tab]").nth(0).click();
  await expect(page.locator(".pm-tabs [role=tab]").nth(0))
    .toHaveText("Permission");
  await expect(page.locator(".pm-tabs [role=tab]").nth(1))
    .toHaveText("API List");
  await page.evaluate(async()=>{
    const {linkCore}=await import("/Implementation/LinkCore/LinkCore.js");
    linkCore.edpmu.update("Language","zh-Hant");
  });
  await page.locator(".pm-tabs [role=tab]").nth(1).click();
  await page.locator(".pm-tabs [role=tab]").nth(0).click();
  await expect(page.locator(".pm-tabs [role=tab]").nth(0))
    .toHaveText("權限");
});

test("Language property does not generate an unknown-ui EHU",async ({page})=>{
  await openManager(page);
  const errors=await page.evaluate(async()=>{
    const {linkCore}=await import("/Implementation/LinkCore/LinkCore.js");
    return linkCore.getSnapshot().logs.filter(e=>e.kind==="EHU"&&
      e.source==="ui"&&e.target==="Language"&&e.status===404);
  });
  expect(errors).toHaveLength(0);
});

test("minimal performance shows only bounded text loading controls",
  async ({page})=>{
    await openManager(page);
    await page.locator(".pm-tabs [role=tab]").nth(3).click();
    await expect(page.locator("#pluginMaxMiB")).toBeVisible();
    await expect(page.locator("#pluginApply")).toBeVisible();
    await expect(page.locator("#pluginLimitNote")).toBeVisible();
    await expect(page.locator("#pluginToolToggle")).toHaveCount(0);
    await expect(page.locator("#pluginUnlimited")).toHaveCount(0);
    await expect(page.locator(".plugin-workbench-header")).toHaveCount(0);
    await expect(page.locator(".plugin-panel-heading")).toHaveCount(0);
    await page.locator("#pluginMaxMiB").fill("16");
    await page.locator("#pluginApply").click();
    await expect(page.locator("#pluginMaxMiB")).toHaveValue("16");
  });

test("startup and language restore never access removed category controls",
  async ({page})=>{
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto("/");
    await expect(page.locator("#menuBtn")).toBeVisible();
    await expect(page.locator("#pluginCategoryMenu")).toHaveCount(0);
    await expect(page.locator("#pluginCategoryBtn")).toHaveCount(0);
    await openManager(page);
    await expect(page.locator(".pm-tabs [role=tab]")).toHaveCount(4);
    expect(errors.filter(message=>message.includes(
      "Cannot set properties of null"))).toEqual([]);
  });

test("Plugin Manager mounts without missing-DOM errors on startup",
  async ({page})=>{
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto("/");
    await expect(page.locator("#pluginManagerPages")).toHaveCount(1);
    await expect(page.locator("#pluginLegacySettings")).toHaveCount(1);
    await openManager(page);
    await expect(page.locator(".pm-shell")).toBeVisible();
    expect(errors.filter(x=>/Missing Plugin Manager DOM/.test(x)))
      .toHaveLength(0);
  });

test("Plugin List collapses and search matches status without select",
  async ({page})=>{
    await openManager(page);
    await page.evaluate(async()=>{
      const {linkCore}=await import("/Implementation/LinkCore/LinkCore.js");
      linkCore.register({id:"SearchOwner",receive:async()=>null,
        ocda:{Request:["run"],Response:[],UserAPI:[],AgentAPI:[],
          Property:[],Program:{},EHU:[],Log:[]}});
      const manifest={
        manifestVersion:1,providerId:"search.plugin",
        objectId:"SearchOwner",
        provides:[{service:"search.service",action:"run",
          version:"1.0.0",inputSchema:{type:"object"},
          outputSchema:{type:"object"}}],
        requires:[],permissions:[],
        execution:{isolation:"worker",concurrency:"serial"}
      };
      if(!linkCore.registerProvider("SearchOwner",manifest).ok)
        throw Error("Fixture registration failed");
    });
    await page.locator(".pm-tabs [role=tab]").nth(1).click();
    await page.locator(".pm-tabs [role=tab]").nth(0).click();
    await expect(page.locator("#pluginManagerFilter")).toHaveCount(0);
    await page.locator("#pluginManagerSearch").fill("Enabled");
    await expect(page.locator(".pm-provider")).toHaveCount(1);
    await page.locator("#pluginManagerSearch").fill("Disabled");
    await expect(page.locator(".pm-provider")).toHaveCount(0);
    await page.locator("#pluginManagerSearch").fill("search.plugin");
    await expect(page.locator(".pm-provider")).toHaveCount(1);
    await page.locator("#pluginSidebarToggle").click();
    await expect(page.locator(".pm-sidebar"))
      .toHaveClass(/pm-sidebar-collapsed/);
    await expect(page.locator("#pluginManagerSearch")).toBeHidden();
    await page.locator("#pluginSidebarToggle").click();
    await expect(page.locator("#pluginManagerSearch")).toBeVisible();
    await expect(page.locator("#pluginManagerSearch"))
      .toHaveValue("search.plugin");
  });

test("Resources exports JSON and both panes scroll independently",
  async ({page})=>{
    await openManager(page);
    await page.locator(".pm-tabs [role=tab]").nth(3).click();
    await expect(page.locator(".pm-tabs [role=tab]").nth(3))
      .toHaveText("資源");
    await expect(page.locator("#pluginMaxMiB")).toBeVisible();
    await expect(page.locator(".pm-resource-pane")).toHaveCount(2);
    const scroll=await page.locator(".pm-resource-pane").evaluateAll(
      nodes=>nodes.map(node=>getComputedStyle(node).overflowY));
    expect(scroll).toEqual(["auto","auto"]);
    const download=page.waitForEvent("download");
    await page.getByRole("button",{name:"匯出完整 API 契約"}).click();
    expect((await download).suggestedFilename())
      .toBe("ClusterOpt2-API-Contracts.json");
    const logDownload=page.waitForEvent("download");
    await page.getByRole("button",{name:"下載 EHU 日誌 JSON"}).click();
    expect((await logDownload).suggestedFilename())
      .toBe("clusteropt2-ehu-log.json");
    await expect(page.locator("#pluginResourceSearch")).toBeVisible();
  });

test("API explorer presents schema fields and raw contract",
  async ({page})=>{
    await openManager(page);
    await page.evaluate(async()=>{
      const {linkCore}=await import("/Implementation/LinkCore/LinkCore.js");
      linkCore.register({id:"SchemaOwner",receive:async()=>null,
        ocda:{Request:["run"],Response:[],UserAPI:["run"],
          AgentAPI:[],Property:[],Program:{},EHU:[],Log:[]}});
      linkCore.registerProvider("SchemaOwner",{
        manifestVersion:1,providerId:"schema.plugin",
        objectId:"SchemaOwner",
        provides:[{service:"schema.service",action:"run",
          version:"1.0.0",inputSchema:{type:"object",
            properties:{message:{type:"string"}},
            required:["message"]},
          outputSchema:{type:"object"}}],
        requires:[],permissions:[],
        execution:{isolation:"worker",concurrency:"serial"}
      });
    });
    await page.locator(".pm-tabs [role=tab]").nth(1).click();
    await page.locator(".pm-api-kind").selectOption("service");
    await page.locator("#pluginApiSearch").fill("schema.service");
    await page.locator(".pm-api-row-link").click();
    await expect(page.locator(".pm-contract-heading"))
      .toContainText("schema.service");
    await expect(page.locator(".pm-contract-section"))
      .toHaveCount(5);
    await expect(page.locator(".pm-contract-section"))
      .toContainText(["契約概覽", "Worker SDK", "Request / Response", "輸入與輸出", "原始註冊契約"]);
    await expect(page.locator(".pm-schema-row"))
      .toContainText(["輸入","message","輸出"]);
    await expect(page.locator(".pm-contract-json"))
      .toContainText('"required"');
  });
