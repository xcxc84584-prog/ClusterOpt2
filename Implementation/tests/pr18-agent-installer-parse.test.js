import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../plugins/ai-agent-mcp/local-agent/",
  import.meta.url);

test("PR18 pinned CMD fetches corrected complete setup helper", async () => {
  const cmd = await readFile(new URL("Quick-Setup.cmd", root), "utf8");
  const ps = await readFile(new URL("Setup-Quick.ps1", root), "utf8");
  assert.match(cmd, /set "REV=[a-f0-9]{40}"/);
  assert.match(cmd, /-SourceRevision "%REV%"/);
  assert.equal((ps.match(/\btry\s*\{/g) || []).length,
    (ps.match(/\}\s*finally\s*\{/g) || []).length +
      (ps.match(/\}\s*catch\s*\{/g) || []).length);
  assert.match(ps, /if \(\$approval -notmatch '\^\[Yy\]\$'\)/);
  assert.match(ps, /'node-pty remains unavailable'/);
  assert.match(ps, /Background-Agent\.ps1/);
  assert.match(ps, /-Action Start -Origin \$origin/);
  assert.match(ps, /No Local Agent listener record/);
  assert.match(ps, /Get-NetTCPConnection -LocalPort \$activePort/);
  assert.match(ps, /-Action Token/);
  assert.match(ps.trimEnd(), /\}\s*finally\s*\{\s*Pop-Location\s*\}$/);
});

test("PR18 sandbox CSP keeps isolation without ignored navigate-to", async () => {
  const bridge = await readFile(new URL(
    "../LinkCore/PluginSandboxBridge.js", import.meta.url), "utf8");
  assert.doesNotMatch(bridge, /"navigate-to 'none'/);
  for (const directive of ["default-src 'none'", "frame-src 'none'",
    "connect-src 'none'", "form-action 'none'",
    "base-uri 'none'"]) {
    assert.ok(bridge.includes(directive), directive);
  }
});
