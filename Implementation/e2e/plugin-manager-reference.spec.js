import { test, expect } from "@playwright/test";

test("reference layout and migrated performance settings",async ({page})=>{
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await expect(page.locator(".pm-shell")).toBeVisible();
  await expect(page.locator(".pm-tabs [role=tab]")).toHaveCount(6);
  await expect(page.locator(".pm-sidebar")).toBeVisible();
  await page.locator("#pluginToolToggle").click();
  await expect(page.locator("#pluginLegacySettings")).toBeVisible();
  await expect(page.locator("#pluginMaxMiB")).toBeVisible();
  await page.locator("#pluginToolToggle").click();
  await expect(page.locator("#pluginLegacySettings")).toBeHidden();
});
test("registered Provider renders four live overview cards",async ({page})=>{
  await page.goto("/");
  await page.evaluate(async()=>{
    const { linkCore }=await import("/Implementation/LinkCore/LinkCore.js");
    linkCore.register({id:"LayoutOwner",receive:async()=>null,
      ocda:{Request:["run"],Response:[],UserAPI:["run"],AgentAPI:[],
        Property:[],Program:{},EHU:[],Log:[]}});
    linkCore.registerProvider("LayoutOwner",{
      manifestVersion:1,providerId:"example.plugin",objectId:"LayoutOwner",
      provides:[{service:"example.render",action:"run",version:"1.0.0",
        inputSchema:{type:"object"},outputSchema:{type:"object"}}],
      requires:[],permissions:["document.slice.read"],
      execution:{isolation:"worker",concurrency:"serial"}});
  });
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  await expect(page.locator(".pm-provider")).toHaveCount(1);
  await expect(page.locator(".pm-grid .pm-card")).toHaveCount(4);
  await expect(page.locator(".pm-hero-info")).toContainText("example.plugin");
  await page.locator(".pm-tabs [role=tab]").nth(2).click();
  await page.locator(".pm-permission-row button").click();
  await expect(page.locator(".plugin-consent-dialog")).toBeVisible();
  await page.locator(".plugin-consent-dialog button").first().click();
  await page.locator(".pm-tabs [role=tab]").nth(0).click();
  await page.locator(".pm-switch input").uncheck();
  await expect(page.locator(".pm-hero-info")).toContainText("Disabled");
});
test("Language read creates no 404 EHU for ui source",async ({page})=>{
  await page.goto("/");
  await page.locator("#menuBtn").click();
  await page.locator("#toolBtn").click();
  await page.locator("#pluginBtn").click();
  const errors=await page.evaluate(async()=>{
    const { linkCore }=await import("/Implementation/LinkCore/LinkCore.js");
    return linkCore.getSnapshot().logs.filter(e=>e.kind==="EHU"&&
      e.source==="ui"&&e.target==="Language"&&e.status===404);
  });
  expect(errors).toHaveLength(0);
});
