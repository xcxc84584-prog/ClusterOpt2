import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { PowerShellManager } from
  "../main/legacy-powershell/powershell-manager.js";
import { createSetupCmd, setupFilename, PLA_SOURCE } from
  "../main/legacy-powershell/cmd-setup.js";

const version = new LinkCore().getSnapshot().version;
const nativeInstaller = readFileSync(fileURLToPath(
  new URL("../local-agent/install-current.ps1", import.meta.url)), "utf8");
const nativeServer = readFileSync(fileURLToPath(
  new URL("../local-agent/server.mjs", import.meta.url)), "utf8");

test("PR9 current version propagates into UI installer and CMD filename", () => {
  assert.match(version, /^0\.0\.\d+-pr\d+\.patch\d+(?:\.fix\d+)?$/u);
  const cmd = createSetupCmd({ version });
  assert.equal(setupFilename(version),
    "ClusterOpt2-PLA-Setup-" + version + ".cmd");
  assert.ok(cmd.includes("ClusterOpt2 PowerShell Local Agent " + version));
  assert.ok(cmd.includes("-ExpectedVersion \"" + version + "\""));
  assert.ok(cmd.includes("ClusterOpt2/main/Implementation/local-agent"));
  assert.ok(PLA_SOURCE.includes("ClusterOpt2/main/Implementation/local-agent"));
  assert.equal(cmd.includes("/ClusterOpt/main/"), false);
  assert.equal(cmd.includes("Stop-Process"), false);
  assert.equal(cmd.includes("force-release"), false);
  assert.ok(cmd.includes("if errorlevel 1 goto failed"));
  assert.equal(setupFilename("1.2.3-pr10.patch7"),
    "ClusterOpt2-PLA-Setup-1.2.3-pr10.patch7.cmd");
  assert.throws(() => createSetupCmd({ version: "../unsafe" }),
    TypeError);
});

test("PR9 installer never kills an unrelated listener", () => {
  assert.ok(nativeInstaller.includes("[P]ick another port / [C]ancel"));
  assert.ok(nativeInstaller.includes("CLUSTEROPT_AGENT_VERSION"));
  assert.ok(nativeInstaller.includes("$manifest.version -ne $ExpectedVersion"));
  assert.ok(nativeInstaller.includes("Agent release mismatch"));
  assert.ok(nativeInstaller.includes("ClusterOpt2/main/Implementation"));
  assert.equal(nativeInstaller.includes("Stop-Process"), false);
  assert.ok(nativeServer.includes("process.env.CLUSTEROPT_AGENT_VERSION"));
  assert.ok(nativeServer.includes("mode:'INTERACTIVE'"));
});

test("PR9 rejects outdated local agents before starting native shell", async () => {
  const healthy = { checkConnection: async () =>
    ({ connected: true, version }) };
  const wrong = { checkConnection: async () =>
    ({ connected: true, version: "0.0.8-pr8.patch25" }) };
  const accepted = new PowerShellManager({
    agent: healthy, expectedVersion: version
  });
  assert.equal((await accepted.checkConnection()).configured, true);
  const rejected = new PowerShellManager({
    agent: wrong, expectedVersion: version
  });
  const status = await rejected.checkConnection();
  assert.equal(status.configured, false);
  assert.equal(status.error, "AGENT_VERSION_MISMATCH");
});
