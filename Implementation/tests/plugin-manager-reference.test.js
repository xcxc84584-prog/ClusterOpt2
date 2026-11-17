import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { LinkCore } from "../LinkCore/LinkCore.js";
test("reference manager uses only live URU and OMU sources",()=>{
  const text=readFileSync(new URL(
    "../main/plugin-manager-ui.js",import.meta.url),"utf8");
  assert.match(text,/core\.uru\.listProviders\(\)/);
  assert.match(text,/core\.edpmu\.get\("Language"\)/);
  assert.doesNotMatch(text,/readProperty\("ui",\s*"Language"\)/);
  assert.match(text,/migrated\.append\(oldSettings\)/);
  assert.match(text,/permissionCard\(p\)/);
  assert.match(text,/event\.isTrusted/);
});
test("global Language property readable without invented Object",()=>{
  const core=new LinkCore();
  assert.equal(typeof core.edpmu.get("Language"),"string");
  assert.equal(core.getSnapshot().logs.some(e=>e.kind==="EHU"&&
    e.target==="Language"&&e.source==="ui"),false);
});

test("plugin manager module parses without duplicate lexical bindings",()=>{
  const path=fileURLToPath(new URL(
    "../main/plugin-manager-ui.js",import.meta.url));
  assert.doesNotThrow(()=>execFileSync(process.execPath,
    ["--check",path],{stdio:"pipe"}));
});

test("sketch tabs and API explorer use registered contracts",()=>{
  const source=readFileSync(new URL(
    "../main/plugin-manager-ui.js",import.meta.url),"utf8");
  assert.match(source,/VIEWS=Object\.freeze\(\["permissions","api","ehu","performance"\]\)/);
  assert.match(source,/core\.catalog\.collect\(\)/);
  assert.match(source,/core\.edpmu\.list\(\)/);
  assert.match(source,/provider\.provides/);
  assert.match(source,/JSON\.stringify\(entry\.descriptor,null,2\)/);
});

test("registered provider API schemas are discoverable from live registry",()=>{
  const core=new LinkCore();
  assert.equal(core.register({
    id:"CatalogPluginOwner",receive:async()=>null,
    ocda:{Request:["run"],Response:[],UserAPI:[],AgentAPI:[],
      Property:[],Program:{},EHU:[],Log:[]}
  }),true);
  const manifest={
    manifestVersion:1,providerId:"catalog.plugin",
    objectId:"CatalogPluginOwner",
    provides:[{service:"catalog.example",action:"run",version:"1.0.0",
      inputSchema:{type:"object",properties:{value:{type:"string"}}},
      outputSchema:{type:"object"}}],
    requires:[],permissions:[],
    execution:{isolation:"worker",concurrency:"serial"}
  };
  assert.equal(core.registerProvider("CatalogPluginOwner",manifest).ok,true);
  const registered=core.uru.listProviders();
  assert.equal(registered.length,1);
  assert.equal(registered[0].provides[0].service,"catalog.example");
  assert.equal(registered[0].provides[0].inputSchema.properties.value.type,
    "string");
});
