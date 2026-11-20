import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = new URL("../../index.html", import.meta.url);
const audit = new URL("../../PR/PR23/UI-Inventory.md", import.meta.url);

function htmlIds() {
	const source = readFileSync(index, "utf8");
	const tags = /<([a-z][a-z0-9-]*)\b([^>]*?)>/gi;
	const idAttribute = /\bid\s*=\s*["']([^"']+)["']/i;
	const ids = [];
	for (const match of source.matchAll(tags)) {
		const id = idAttribute.exec(match[2])?.[1];
		if (id) ids.push(id);
	}
	return ids;
}

test("PR23.1 static HTML IDs are unique", () => {
	const ids = htmlIds();
	assert.ok(ids.length > 0);
	assert.equal(new Set(ids).size, ids.length);
});

test("PR23.1 inventory covers every static HTML ID", () => {
	const document = readFileSync(audit, "utf8");
	const staticSection = document.split("## Dynamic literal ID declarations")[0];
	const recorded = new Set([...staticSection.matchAll(
		/^\| ([A-Za-z][A-Za-z0-9_-]*) \|/gm
	)].map(match => match[1]));
	const ids = htmlIds();
	assert.deepEqual([...recorded].sort(), [...ids].sort());
});

test("PR23.1 audit does not claim full runtime or API coverage", () => {
	const document = readFileSync(audit, "utf8");
	assert.match(document, /not\*\* a complete runtime DOM inventory/i);
	assert.match(document, /NOT YET AUDITED/);
	assert.match(document, /PENDING/);
});
