import test from "node:test";
import assert from "node:assert/strict";
import {install, multilangHighlighter, resolveLanguage} from
	"../plugins/multilang-highlighter.js";

test("PR11: tokens preserve the exact source across languages", () => {
	const cases = [
		["a.js", "const x = 2; // comment", "keyword"],
		["a.ts", "interface X {}", "keyword"],
		["a.py", "# note\ndef main(): pass", "comment"],
		["a.cpp", "int main() { /* hi */ }", "comment"],
		["a.java", "public class A {}", "keyword"],
		["a.css", "#id { color: red; }", "operator"],
		["a.html", "<!-- hi --><p>Hi</p>", "comment"],
		["a.json", '{"a": true}', "string"],
		["a.sql", "SELECT a -- note\nFROM t", "comment"],
		["a.unknown", "<script>literal</script>", "plain"]
	];
	for (const [file, source, category] of cases) {
		const result = multilangHighlighter.tokenize(source, file);
		assert.equal(result.ok, true, file);
		assert.equal(result.status, 200);
		assert.equal(result.value.tokens.map(token => token.text).join(""),
			source, file);
		assert.ok(result.value.tokens.some(token =>
			token.type === category), file);
	}
});

test("PR11: language-specific comment rules avoid false positives", () => {
	const css = multilangHighlighter.tokenize("#selector {}", "a.css");
	assert.equal(css.value.tokens.some(t => t.type === "comment"), false);
	const quoted = multilangHighlighter.tokenize(
		'const s = "// not comment";', "a.js");
	assert.equal(quoted.value.tokens.some(t => t.type === "comment"), false);
	assert.equal(resolveLanguage("example.PY"), "py");
	assert.equal(resolveLanguage("script.sql"), "sql");
});

test("PR11: bounded tokenizer never returns markup or skips text", () => {
	assert.equal(multilangHighlighter.tokenize(null).status, 400);
	assert.equal(multilangHighlighter.tokenize("x".repeat(65537)).status, 413);
	const text = '<img src=x onerror="alert(1)">';
	const result = multilangHighlighter.tokenize(text, "a.html");
	assert.equal(result.value.tokens.map(t => t.text).join(""), text);
	assert.ok(result.value.tokens.every(t =>
		typeof t.text === "string" && !Object.hasOwn(t, "html")));
});

test("PR11: registration is idempotent and conflicts fail closed", () => {
	const objects = new Map();
	let provider = null;
	const core = {
		uru: {
			objects,
			getProvider(id) {
				return provider?.providerId === id ? provider : null;
			}
		},
		register(object) {
			objects.set(object.id, object);
			return true;
		},
		unregister(id) { objects.delete(id); },
		registerProvider(source, manifest) {
			assert.equal(source, manifest.objectId);
			provider = manifest;
			return {ok: true, status: 201};
		}
	};
	assert.equal(install(core).status, 201);
	assert.equal(install(core).alreadyInstalled, true);
	assert.equal(provider.provides[0].service, "editor.syntax.highlight");
	assert.equal(provider.execution.concurrency, "per-slice");
	const object = objects.get("SampleMultiLanguageHighlighter");
	assert.deepEqual(object.ocda.AgentAPI, []);
	const result = object.receive("highlight", {
		text: "const x = 1", fileName: "a.js"
	});
	assert.equal(result.tokens.map(token => token.text).join(""),
		"const x = 1");
	assert.throws(() => object.receive("highlight", {
		text: "x".repeat(65537), fileName: "a.js"
	}), error => error.status === 413);
	provider = null;
	assert.equal(install(core).status, 409);
});

test("PR11: a rejected provider leaves no half-registered object", () => {
	const objects = new Map();
	const core = {
		uru: {objects},
		register(object) {objects.set(object.id, object); return true;},
		unregister(id) {objects.delete(id);},
		registerProvider() {return {ok: false, status: 400};}
	};
	assert.equal(install(core).status, 400);
	assert.equal(objects.size, 0);
});
