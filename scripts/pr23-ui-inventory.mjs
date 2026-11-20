/**
 * PR23.1: generate a reproducible static native UI source inventory.
 *
 * This is an offline audit. No DOM mutation, plugin activation, token,
 * permission grant, or public user-facing element is introduced.
 * Static HTML IDs are ground truth only for the HTML layer.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const html = readFileSync(join(root, "index.html"), "utf8");
const sources = [
	"Implementation/main",
	"Implementation/object",
	"Implementation/LinkCore"
];
const htmlPattern = /<([a-z][a-z0-9-]*)\b([^>]*?)>/gi;
const idPattern = /\bid\s*=\s*["']([^"']+)["']/i;
const refPattern = /\bgetElementById\s*\(\s*["']([^"']+)["']\s*\)/g;
const controlPattern = /\b(createElement|appendChild|insertBefore)\s*\(/;
const entries = new Map();
const files = [];

function walk(directory) {
	for (const item of readdirSync(join(root, directory), {
		withFileTypes: true
	})) {
		const name = join(directory, item.name);
		if (item.isDirectory()) walk(name);
		else if (item.isFile() && item.name.endsWith(".js")) {
			files.push(name.replaceAll("\\", "/"));
		}
	}
}

for (const directory of sources) walk(directory);
for (const match of html.matchAll(htmlPattern)) {
	const id = idPattern.exec(match[2])?.[1];
	if (!id) continue;
	const line = html.slice(0, match.index).split("\n").length;
	const prior = entries.get(id);
	if (prior) {
		prior.duplicates.push(line);
		continue;
	}
	entries.set(id, {
		id, tag: match[1].toLowerCase(), line,
		duplicates: [], referencedBy: []
	});
}

const dynamicFiles = [];
const dynamicIds = [];
const assignment = /\.id\s*=\s*["']([^"']+)["']/g;
const attribute = /setAttribute\s*\(\s*["']id["']\s*,\s*["']([^"']+)["']/g;
for (const file of files) {
	const source = readFileSync(join(root, file), "utf8");
	const references = [...source.matchAll(refPattern)].map(item => item[1]);
	for (const id of new Set(references)) {
		if (entries.has(id)) entries.get(id).referencedBy.push(file);
	}
	if (controlPattern.test(source)) dynamicFiles.push(file);
	for (const pattern of [assignment, attribute]) {
		for (const match of source.matchAll(pattern)) {
			dynamicIds.push({
				id: match[1], source: file,
				line: source.slice(0, match.index).split("\n").length
			});
		}
	}
}

function esc(value) {
	return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

const rows = [...entries.values()].sort((a, b) => a.line - b.line);
const lines = [
	"# PR23.1 — Native UI Inventory (static source audit)",
	"",
	"Generated from this repository's index.html and Implementation JS.",
	"This is **not** a complete runtime DOM inventory or API coverage PASS.",
	"",
	"## Coverage",
	"",
	"- Static HTML IDs: " + rows.length,
	"- Duplicate static IDs: " +
		rows.reduce((sum, row) => sum + row.duplicates.length, 0),
	"- JS files scanned: " + files.length,
	"- Files containing dynamic DOM creation/insertion: " +
		dynamicFiles.length,
	"- Verified UISP API coverage: NOT YET AUDITED",
	"- Browser-rendered and plugin-generated elements: PENDING",
	"",
	"## Static UI elements",
	"",
	"| HTML ID | Tag | Source | Literal JS getElementById references | UISP API |",
	"| --- | --- | --- | --- | --- |"
];
for (const row of rows) {
	lines.push([
		esc(row.id),
		esc(row.tag),
		"index.html:" + row.line,
		esc(row.referencedBy.join(", ") || "none found"),
		"Not verified"
	].join(" | ").replace(/^/, "| ").concat(" |"));
}
lines.push(
	"",
	"## JS modules with dynamically constructed UI",
	"",
	"The list indicates DOM creation/insertion patterns only.",
	"Each module still requires runtime inspection and stable ID mapping.",
	""
);
for (const file of dynamicFiles) lines.push("- `" + file + "`");
lines.push(
	"",
	"## Dynamic literal ID declarations",
	"",
	"These are static assignment occurrences, not verified live DOM nodes.",
	"Generated and nonliteral IDs require browser inspection.",
	"",
	"| Literal ID | Source | Static HTML ID? |",
	"| --- | --- | --- |",
	...dynamicIds.map(entry =>
		"| " + esc(entry.id) + " | " + esc(entry.source) +
		":" + entry.line + " | " +
		(entries.has(entry.id) ? "yes" : "no") + " |"),
	"",
	"## Pending manual/browser verification",
	"",
	"- Compare DOM after menu opens, plugins load, windows dock and tabs change.",
	"- Inspect runtime-generated IDs, class-based controls and shadow roots.",
	"- Link each UI ID to OCDA Object, UISP Property and HubUnit Request/Response.",
	"- Determine geometry source, parent, theme, locale, focus, tab, z-index.",
	"- Distinguish native controls from plugin-owned extension slots.",
	"- Verify accessibility/keyboard behavior and responsive constraints.",
	"- Reconcile every UI API with API List and OMU Event Chains.",
	""
);

const output = resolve(root, "PR/PR23/UI-Inventory.md");
writeFileSync(output, lines.join("\n") + "\n", "utf8");
process.stdout.write(
	"UI-INVENTORY staticIds=" + rows.length +
	" dynamicSourceFiles=" + dynamicFiles.length +
	" output=" + relative(root, output) + "\n"
);
