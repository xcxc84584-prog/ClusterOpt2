import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  AI_AGENT_PACKAGE_FILES,
  fetchAgentPackageFiles
} from "../main/plugin-agent-download.js";
import { createTemplateZip } from "../main/plugin-template-download.js";
import { PluginFolderPackagePolicy } from
  "../property/PluginFolderPackagePolicy.js";

const assets = resolve(dirname(fileURLToPath(import.meta.url)),
  "../plugins/ai-agent-mcp");

test("PR15.1 all downloadable files exist and form an installable package",
  async () => {
    const fetched = await fetchAgentPackageFiles(async url => {
      assert.ok(url.startsWith("./Implementation/plugins/ai-agent-mcp/"));
      const name = url.slice(
        "./Implementation/plugins/ai-agent-mcp/".length);
      try {
        return { ok: true, text: async () =>
          readFile(resolve(assets, name), "utf8") };
      } catch {
        return { ok: false };
      }
    });
    assert.equal(Object.keys(fetched).length, AI_AGENT_PACKAGE_FILES.length);
    assert.equal(new Set(AI_AGENT_PACKAGE_FILES).size,
      AI_AGENT_PACKAGE_FILES.length);
    // Regression: new gateway scripts must appear exactly once in ZIP.
    for (const file of [
      "local-agent/Background-Gateway.ps1",
      "local-agent/Setup-MCP.ps1"
    ]) {
      assert.equal(AI_AGENT_PACKAGE_FILES.filter(
        name => name === file).length, 1);
    }
    const manifest = JSON.parse(fetched["plugin.json"]);
    assert.equal(manifest.provider.providerId, "cluster.ai-agent-mcp");
    assert.deepEqual(manifest.provider.permissions, [
      "network.request", "local-agent.pair", "model.configure",
      "model.task", "shell.execute", "mcp.read"
    ]);
    const files = Object.fromEntries(Object.entries(fetched).map(
      ([name, value]) => [name, Buffer.from(value).toString("base64")]));
    assert.equal(PluginFolderPackagePolicy.inspect({
      format: "cluster-plugin-folder", formatVersion: 1,
      manifestText: fetched["plugin.json"], files
    }).status, 200);
    const zip = createTemplateZip(fetched);
    assert.equal(Buffer.from(zip).readUInt32LE(0), 0x04034b50);
    assert.equal(Buffer.from(zip).readUInt16LE(zip.length - 22 + 10),
      AI_AGENT_PACKAGE_FILES.length);
  });

test("PR15.1 source publisher refuses missing or over-budget assets",
  async () => {
    await assert.rejects(fetchAgentPackageFiles(async () =>
      ({ ok: false })), /Missing plugin asset/);
    await assert.rejects(fetchAgentPackageFiles(async () =>
      ({ ok: true, text: async () => "x".repeat(1048577) })),
    /ZIP budget/);
  });
