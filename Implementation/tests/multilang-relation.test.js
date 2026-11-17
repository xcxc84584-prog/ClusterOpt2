import test from "node:test";
import assert from "node:assert/strict";
import {LinkCore} from "../LinkCore/LinkCore.js";
import {install} from "../plugins/multilang-highlighter.js";

test("PR11 Relation: service runs through Hub and records dependency", async () => {
	const core = new LinkCore();
	assert.equal(core.register({
		id: "TestUI",
		strictOCDA: true,
		ocda: {
			EHU: [], Log: [], Request: [], Response: [],
			UserAPI: [], AgentAPI: [], Property: [], Program: []
		},
		receive() {throw Error("UI must not receive");}
	}), true);

	const installed = install(core);
	assert.equal(installed.ok, true, JSON.stringify(installed));
	const result = await core.requestService(
		"TestUI", "editor.syntax.highlight", "highlight", {
			text: "const x = 42;", fileName: "sample.js"
		}, {origin: "user"});
	assert.equal(result.ok, true, JSON.stringify(result));
	assert.equal(result.status, 200);
	assert.equal(result.value.tokens.map(t => t.text).join(""),
		"const x = 42;");

	const snapshot = core.getSnapshot();
	assert.ok(snapshot.objects.includes("SampleMultiLanguageHighlighter"));
	assert.ok(snapshot.logs.some(item =>
		item.action === "Request.highlight" && item.status === 200));
	assert.ok(snapshot.logs.some(item =>
		item.action === "Response.highlight" && item.status === 200));
});

test("PR11 Relation: invalid text produces EHU 413", async () => {
	const core = new LinkCore();
	core.register({
		id: "TestUI",
		ocda: {
			EHU: [], Log: [], Request: [], Response: [],
			UserAPI: [], AgentAPI: [], Property: [], Program: []
		},
		receive() {}
	});
	assert.equal(install(core).ok, true);
	const result = await core.requestService(
		"TestUI", "editor.syntax.highlight", "highlight", {
			text: "x".repeat(65537), fileName: "sample.js"
		}, {origin: "user"});
	assert.equal(result.ok, false);
	assert.equal(result.status, 413);
	assert.ok(core.getSnapshot().logs.some(item =>
		item.kind === "EHU" && item.status === 413));
});
