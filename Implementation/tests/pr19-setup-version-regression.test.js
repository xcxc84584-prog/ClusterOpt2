import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ReleaseVersion } from "../property/ReleaseVersion.js";
import { setupFilename } from "../main/legacy-powershell/cmd-setup.js";

test("PR19 release version is centralized at 0.0.15a", async () => {
  assert.equal(ReleaseVersion.product, "0.0.15a");
  assert.equal(JSON.parse(await readFile(
    new URL("../../package.json", import.meta.url), "utf8"
  )).version, ReleaseVersion.product);
  assert.equal(JSON.parse(await readFile(
    new URL("../local-agent/package.json", import.meta.url), "utf8"
  )).version, ReleaseVersion.product);
  assert.match(setupFilename("0.0.15a"), /0\.0\.15a\.cmd$/);
});

test("PR19 CMD does not mistake CHOICE=Y for a failed mkdir", async () => {
  const cmd = await readFile(new URL(
    "../plugins/ai-agent-mcp/local-agent/Quick-Setup.cmd",
    import.meta.url), "utf8");
  const y = cmd.indexOf('choice /M "Continue"');
  const checkN = cmd.indexOf("if errorlevel 2 exit /b 0", y);
  const checkY = cmd.indexOf("if errorlevel 1 goto confirmed", checkN);
  const make = cmd.indexOf('if not exist "%ROOT%" (', checkY);
  const testMkdir = cmd.indexOf("if errorlevel 1 goto failed", make);
  assert.ok(y >= 0 && checkN > y && checkY > checkN);
  assert.ok(make > checkY && testMkdir > make);
  assert.match(cmd, /mkdir "%ROOT%"\s*\n\s*if errorlevel 1 goto failed/);
  assert.doesNotMatch(cmd,
    /if not exist "%ROOT%" mkdir "%ROOT%"\s*\nif errorlevel 1 goto failed/);
});
