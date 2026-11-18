import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PluginLocalAgentPolicy as Policy } from
  "../property/PluginLocalAgentPolicy.js";

const root = new URL("../plugins/ai-agent-mcp/local-agent/",
  import.meta.url);

test("PR17 P mode only connects to explicit loopback ports", () => {
  assert.equal(Policy.addressForPort(43879),
    "ws://127.0.0.1:43879/agent");
  assert.equal(Policy.addressForPort(44001),
    "ws://127.0.0.1:44001/agent");
  for (const bad of [0, 1023, 65536, -1, 43879.5, "44001"]) {
    assert.equal(Policy.validPort(bad), false);
    assert.throws(() => Policy.addressForPort(bad), TypeError);
  }
});

test("PR17 standalone CMD bootstraps immutable helper without ZIP",
  async () => {
    const cmd = await readFile(new URL("Quick-Setup.cmd", root), "utf8");
    assert.match(cmd, /^@echo off/);
    assert.match(cmd, /raw\.githubusercontent\.com/);
    assert.match(cmd, /set "REV=[a-f0-9]{40}"/);
    assert.match(cmd, /-SourceRevision "%REV%"/);
    assert.match(cmd, /choice \/M "Continue"/);
    assert.doesNotMatch(cmd, /Expand-Archive|\.zip/);
  });

test("PR17 port override uses two-step consent and PID recheck",
  async () => {
    const setup = await readFile(new URL("Setup-Quick.ps1", root), "utf8");
    const cpo = await readFile(new URL("Port-CPO.ps1", root), "utf8");
    const background = await readFile(new URL("Background-Agent.ps1", root), "utf8");
    assert.match(setup, /Background-Agent\.ps1/);
    assert.match(background, /Select-ServicePort 'terminal'/);
    assert.match(cpo, /function Select-ServicePort/);
    assert.match(cpo, /'P'\s*\{/);
    assert.match(cpo, /'C'\s*\{/);
    assert.match(cpo, /'O'\s*\{/);
    assert.match(cpo, /Type OVERRIDE/);
    assert.match(cpo, /CreationDate -ne \$owner\.CreationDate/);
    assert.match(cpo, /Stop-Process -Id \$owner\.ProcessId/);
    assert.match(background, /CLUSTER_TERMINAL_PORT/);
    assert.match(setup, /install-scripts approve node-pty/);
  });
