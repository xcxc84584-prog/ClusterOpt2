import test from "node:test";
import assert from "node:assert/strict";
import {install, multilangHighlighter} from
  "../plugins/multilang-highlighter.js";

test("highlighter produces bounded multi-language tokens", () => {
  const cases = [
    ["a.js", "const count = 42;", "keyword"],
    ["a.ts", "interface User {}", "keyword"],
    ["a.py", "def greet():", "keyword"],
    ["a.cpp", "int main() {}", "keyword"],
    ["a.java", "public class Demo {}", "keyword"],
    ["a.json", '{"active": true}', "string"],
    ["a.sql", "SELECT id FROM users", "keyword"]
  ];
  for (const [name, code, type] of cases) {
    const result = multilangHighlighter.tokenize(code, name);
    assert.equal(result.ok, true, name);
    assert.ok(result.value.tokens.some(token => token.type === type));
    assert.equal(result.value.tokens.map(item => item.text).join(""), code);
  }
});

test("unknown language is safe plaintext; oversized inputs fail", () => {
  const plain = multilangHighlighter.tokenize("<script>", "a.unknown");
  assert.equal(plain.value.tokens[0].type, "plain");
  assert.equal(multilangHighlighter.tokenize("x".repeat(65537)).status, 413);
});

test("OCDA plugin installs idempotently and registers one Provider", () => {
  const objects = new Map();
  let manifest;
  const core = {
    uru: {objects},
    register(object) {
      objects.set(object.id,object);
      return true;
    },
    unregister(id) {objects.delete(id);},
    registerProvider(source,input) {
      assert.equal(source,input.objectId);
      manifest = input;
      return {ok:true,status:201};
    }
  };
  assert.equal(install(core).status, 201);
  assert.equal(install(core).alreadyInstalled, true);
  assert.equal(manifest.provides[0].service,"editor.syntax.highlight");
  const output = objects.get("SampleMultiLanguageHighlighter")
    .receive("highlight",{text:"const x = 1",fileName:"test.js"});
  assert.equal(output.tokens.map(token => token.text).join(""),
    "const x = 1");
  assert.throws(() => objects.get("SampleMultiLanguageHighlighter")
    .receive("highlight",{text:"x".repeat(65537),fileName:"test.js"}));
});
