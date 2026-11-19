import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../plugins/ai-agent-mcp/local-agent/",
  import.meta.url);
const read = file => readFileSync(new URL(file, root), "utf8");

test("PR14.8 vendored Node gateways are syntax-valid", () => {
  for (const name of [
    "server.cjs", "remote-mcp.cjs", "mcp-stdio.cjs",
    "oauth-mcp-gateway.cjs"
  ]) {
    const source = new URL(name, root);
    assert.equal(existsSync(source), true);
    const result = spawnSync(process.execPath,
      ["--check", fileURLToPath(source)], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("PR14.8 OAuth gateway keeps PKCE and read-only scope", () => {
  const source = read("oauth-mcp-gateway.cjs");
  assert.match(source, /S256/);
  assert.match(source, /cluster\.read/);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /authorization_code/);
});

test("PR14.8 local gateways retain loopback and bearer protection",
  () => {
    const server = read("server.cjs");
    const remote = read("remote-mcp.cjs");
    assert.match(server, /timingSafeEqual/);
    assert.match(server, /CLUSTER_TERMINAL_ORIGIN/);
    assert.match(server, /127\.0\.0\.1/);
    assert.match(remote, /Bearer/);
    assert.match(remote, /127\.0\.0\.1/);
    const entry = read("Start-LocalAgent.ps1");
    assert.match(entry, /CLUSTER_TERMINAL_ORIGIN/);
    assert.doesNotMatch(entry, /Stop-Process/);
  });
