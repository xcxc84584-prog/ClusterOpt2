import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const excluded = new Set([
  "clusteropt-legacy.css", // Copied unchanged from ClusterOpt.
  "code-conventions.mjs" // Checker scans other project sources.
]);
const paths = [];

function collect(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (item.name === "node_modules" || item.name === ".git") continue;
    // Upstream ClusterOpt v0.0.69 PSM source and CSS are vendored verbatim
    // for 1:1 UI parity. All first-party integration code is still linted.
    if (item.isDirectory() &&
      ["legacy-powershell", "local-agent"].includes(item.name)) continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) collect(path);
    else if (/\.(?:js|mjs|css|html)$/.test(item.name) &&
      !excluded.has(item.name)) paths.push(path);
  }
}

collect(fileURLToPath(new URL("../", import.meta.url)));
const findings = [];
for (const path of paths) {
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const label = path + ":" + (index + 1);
    if (line.length > 120) findings.push(label + ": over 120 columns");
    if (/\s+$/.test(line)) findings.push(label + ": trailing spaces");
    if (/(?:^|[\s"'(])[A-Za-z]:[\\/]/.test(line)) {
      findings.push(label + ": machine-specific absolute path");
    }
  }
  if (/\b(?:apiKey|secret|token)\s*[:=]\s*["'][^"']{12,}["']/i.test(
    content
  )) {
    findings.push(path + ": possible embedded credential");
  }
}
assert.deepEqual(findings, [], findings.join("\n"));
console.log("Code conventions PASS:", paths.length, "source files");
