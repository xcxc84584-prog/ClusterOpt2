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

test("PR9 port override requires explicit confirmation and identity checks", () => {
  assert.ok(nativeInstaller.includes("[P]ick another port / [C]ancel / [O]verride"));
  assert.ok(nativeInstaller.includes("CLUSTEROPT_AGENT_VERSION"));
  assert.ok(nativeInstaller.includes("$manifest.version -ne $ExpectedVersion"));
  assert.ok(nativeInstaller.includes("Agent release mismatch"));
  assert.ok(nativeInstaller.includes("ClusterOpt2/main/Implementation"));
  assert.ok(nativeInstaller.includes("Stop-Process -Id $owner.ProcessId"));
  assert.ok(nativeInstaller.includes("Port owner changed; override aborted"));
  assert.ok(nativeInstaller.includes("Refusing to terminate protected process"));
  assert.ok(nativeInstaller.includes("Override cancelled; no process was terminated"));
  assert.ok(nativeInstaller.includes("Port still occupied; agent not started"));
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

test("PR9 Patch6: native installer is unique and parser protected", () => {
  assert.equal((nativeInstaller.match(/function Download-AgentFile/g) || [])
    .length, 1);
  assert.equal((nativeInstaller.match(/param\(/g) || []).length, 5);
  assert.ok(nativeInstaller.includes("[ValidatePattern("));
  assert.equal(nativeInstaller.includes("UnexpectedToken"), false);
  assert.equal(nativeInstaller.includes("RedirectStandardOutput"), false);
  assert.equal(nativeInstaller.includes("PAIRING TOKEN (keep private)"),
    false);
  assert.ok(nativeInstaller.includes("Install-Dependencies"));
  assert.ok(nativeInstaller.includes("Start-Process @start"));
  assert.ok(nativeInstaller.includes("Select-LoopbackPort"));
  assert.ok(nativeInstaller.includes("npm.cmd"));
  assert.ok(nativeInstaller.includes("Stop-Process -Id $owner.ProcessId"));
});

test("PR9 Patch8: detached agent keeps token off disk and closes CMD", () => {
  const cmd = createSetupCmd({ version });
  const nativeUI = readFileSync(fileURLToPath(new URL(
    "../main/legacy-powershell/powershell-ui.js", import.meta.url)), "utf8");
  const style = readFileSync(fileURLToPath(new URL(
    "../main/legacy-powershell/powershell-legacy.css", import.meta.url)),
    "utf8");

  assert.ok(nativeInstaller.includes("WindowStyle = 'Hidden'"));
  assert.ok(nativeInstaller.includes("CLUSTEROPT_PAIRING_TOKEN"));
  assert.ok(nativeInstaller.includes("RandomNumberGenerator"));
  assert.ok(nativeInstaller.includes("PAIRING TOKEN (copy privately)"));
  assert.ok(nativeInstaller.includes("press ENTER to close this installer"));
  assert.equal(nativeInstaller.includes("RedirectStandardOutput"), false);
  assert.equal(nativeInstaller.includes("OutFile $pairingToken"), false);
  assert.ok(nativeServer.includes("delete process.env.CLUSTEROPT_PAIRING_TOKEN"));
  assert.ok(nativeServer.includes("hasSuppliedToken"));
  assert.match(cmd, /echo ClusterOpt2 agent setup complete\.[^\r\n]*\r\nexit \/b 0/);
  assert.ok(cmd.includes("pause\r\nexit /b 1"));

  assert.ok(nativeUI.includes("xterm-addon-fit@0.8.0"));
  assert.ok(nativeUI.includes("new ResizeObserver("));
  assert.ok(nativeUI.includes("fit.fit()"));
  assert.ok(!nativeUI.includes(String.raw`\\r\\n[Native terminal disconnected]`));
  assert.ok(style.includes(".psm-native-wrap"));
  assert.ok(style.includes("flex: 1 1 0"));
});

test("PR9 Patch9: quoted JavaScript probe replaced by standalone module", () => {
  const agentManifest = JSON.parse(readFileSync(fileURLToPath(
    new URL("../local-agent/package.json", import.meta.url)), "utf8"));
  const probe = readFileSync(fileURLToPath(
    new URL("../local-agent/probe-native.mjs", import.meta.url)), "utf8");

  assert.equal(agentManifest.version, version);
  assert.equal(agentManifest.dependencies["node-pty"], "1.1.0");
  assert.equal(agentManifest.allowScripts["node-pty@1.1.0"], true);
  assert.ok(nativeInstaller.includes("probe-native.mjs"));
  assert.ok(nativeInstaller.includes("$NodePath $probeFile"));
  assert.ok(nativeInstaller.includes("rebuild node-pty"));
  assert.equal(nativeInstaller.includes("$NodePath -e $probe"), false);
  assert.ok(probe.includes('import * as nodePtyModule from "node-pty"'));
  assert.ok(probe.includes('pty.spawn('));
  assert.ok(probe.includes('"powershell.exe"'));
});
