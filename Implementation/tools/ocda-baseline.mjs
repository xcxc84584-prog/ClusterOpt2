/**
 * Read-only OCDA source inventory. Never execute application code.
 * Usage: node Implementation/tools/ocda-baseline.mjs [--json] [--strict]
 */
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = resolve(process.cwd());
const DIRS = ["LinkCore", "object", "property", "main"];
const FIELDS = ["Request", "Response", "UserAPI", "AgentAPI", "Property"];
const norm = value => value.replaceAll("\\", "/");

async function files(folder) {
  let entries;
  try { entries = await readdir(folder, { withFileTypes: true }); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const result = [];
  for (const entry of entries.sort((a, b) =>
    a.name.localeCompare(b.name))) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) {
      result.push(path);
    }
  }
  return result;
}
function matches(source, pattern) {
  return [...source.matchAll(pattern)].map(match => match[1]);
}
function fieldActions(source, field) {
  const pattern = new RegExp("\\b" + field +
    "\\s*:\\s*\\[([\\s\\S]*?)\\]", "g");
  return [...new Set([...source.matchAll(pattern)].flatMap(match =>
    matches(match[1], /["']([^"']+)["']/g)))].sort();
}
function layer(path) {
  if (path.includes("/LinkCore/")) return "LinkCore";
  if (/(VirtualFileDocument|FileDocument|FileWorkspace|Explorer)/.test(path)) return "L1";
  if (/(SliceLoader|SliceRegistry|ViewportSlice|VirtualLine|LineAddress|UTF8Slice|BPlusSlice)/.test(path)) return "L2";
  if (/(Highlighter|Processor|Decoration)/.test(path)) return "L3";
  if (/(Editor|GoToLine|Viewport)/.test(path)) return "L4";
  if (/(SliceEdit|SliceTransaction|PieceTree)/.test(path)) return "L5";
  if (/(Writeback|SliceSave|SliceFileWrite|SliceBatchWrite)/.test(path)) return "L6";
  if (/(Recovery|Journal|DocumentStatus|AccessPolicy)/.test(path)) return "S";
  return "Shared / review";
}
export async function buildBaseline(root = ROOT) {
  const paths = (await Promise.all(DIRS.map(dir =>
    files(join(root, "Implementation", dir))))).flat();
  const nodes = [];
  for (const absolute of paths) {
    const path = norm(relative(root, absolute));
    if (/\/(?:tests|e2e|legacy-powershell)\//.test(path)) continue;
    const source = await readFile(absolute, "utf8");
    const imports = matches(source,
      /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.{1,2}\/[^"']+)["']/g)
      .map(target => norm(relative(root, resolve(join(absolute, ".."), target))))
      .sort();
    const requests = [...source.matchAll(
      /(?:\b(?:this\.)?(?:core|linkCore)\.request\s*\(\s*[^,]+,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["'])/g)]
      .map(match => ({ target: match[1], action: match[2] }));
    nodes.push({
      path, layer: layer(path),
      objectIds: matches(source, /\bthis\.id\s*=\s*["']([^"']+)["']/g),
      imports,
      requests,
      propertyReads: [...new Set(matches(source,
        /\breadProperty\s*\(\s*[^,]+,\s*["']([^"']+)["']/g))].sort(),
      propertiesDefined: [...new Set(matches(source,
        /\bregisterProperty\s*\(\s*["']([^"']+)["']/g))].sort(),
      actions: Object.fromEntries(FIELDS.map(field =>
        [field, fieldActions(source, field)])),
      hasOcda: /\bocda\s*=|\bocda\s*:/.test(source)
    });
  }
  const known = new Set(nodes.map(node => node.path));
  const edges = nodes.flatMap(node => [
    ...node.imports.filter(to => known.has(to))
      .map(to => ({ type: "import", from: node.path, to })),
    ...node.requests.map(item => ({ type: "request", from: node.path,
      to: item.target, action: item.action })),
    ...node.propertyReads.map(to => ({
      type: "property", from: node.path, to
    }))
  ]);
  const missingImports = nodes.flatMap(node => node.imports
    .filter(path => path.startsWith("Implementation/") &&
      !known.has(path) && !path.includes("/legacy-powershell/"))
    .map(target => ({ from: node.path, target })));
  return {
    schemaVersion: 1, root: ".",
    source: "read-only static source inspection",
    summary: { files: nodes.length, edges: edges.length,
      objects: nodes.filter(node => node.objectIds.length).length,
      missingImports: missingImports.length },
    nodes, edges, missingImports,
    limitations: [
      "Dynamic calls and computed contracts need runtime VTE.",
      "Layer classification is ownership only.",
      "No browser, file permission, memory or writeback was tested."
    ]
  };
}
export function markdownReport(result) {
  const rows = [
    "# OCDA baseline — generated static inventory", "",
    "> Not a VTE, browser or disk-writeback acceptance report.", "",
    "- Source files: " + result.summary.files,
    "- Static edges: " + result.summary.edges,
    "- Object-ID-containing files: " + result.summary.objects,
    "- Missing import hints: " + result.summary.missingImports, "",
    "| Layer | File | Object ID | Contract |",
    "| --- | --- | --- | --- |"
  ];
  for (const item of result.nodes) {
    rows.push("| " + item.layer + " | `" + item.path + "` | " +
      (item.objectIds.join(", ") || "—") + " | " +
      (item.hasOcda ? "declared" : "not found") + " |");
  }
  rows.push("", "## Open gates", "",
    "- [ ] VTE and Relation Code runtime execution",
    "- [ ] Browser File System Access and recovery",
    "- [ ] 1 MiB / 64 MiB / 1 GiB / 5 GiB measurements",
    "- [ ] Native Windows ConPTY / PowerShell checks", "");
  return rows.join("\n");
}
if (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await buildBaseline();
  process.stdout.write(process.argv.includes("--json") ?
    JSON.stringify(report, null, 2) + "\n" : markdownReport(report) + "\n");
  if (process.argv.includes("--strict") && report.missingImports.length) {
    process.exitCode = 1;
  }
}
