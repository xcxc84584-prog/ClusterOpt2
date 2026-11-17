import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
