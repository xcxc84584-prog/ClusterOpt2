import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { UISP } from "../property/UISP.js";

function addCaller(core) {
	const caller = {
		id: "UITestCaller",
		receive: async () => null,
		authorization: { default: "Private" },
		ocda: {
			Request: [], Response: [], UserAPI: [], AgentAPI: [],
			Property: [], Program: "Test",
			EHU: "LinkCore.OMU", Log: "LinkCore.OMU"
		}
	};
	assert.equal(core.register(caller), true);
}

test("PR23.3 registers UICO and sole UISP property", () => {
	const core = new LinkCore();
	assert.equal(core.uru.resolve("UICO").ok, true);
	assert.equal(core.edpmu.list().filter(p => p.name === "UISP").length, 1);
	assert.equal(core.edpmu.describe("UISP").visibility, "Public");
	assert.equal(core.edpmu.update("UISP", {}).status, 403);
});

test("PR23.3 Hub routes UICO read-only describe/list", async () => {
	const core = new LinkCore();
	addCaller(core);
	const info = await core.hub.request(
		"UITestCaller", "UICO", "describe", {}, { origin: "user" });
	assert.equal(info.ok, true);
	assert.equal(info.value.protocol, "cluster.ui/1");
	const list = await core.hub.request(
		"UITestCaller", "UICO", "list", {}, { origin: "agent" });
	assert.equal(list.ok, true);
	assert.deepEqual(list.value, []);
});

test("PR23.3 fails closed for unregistered callers and UI writes", async () => {
	const core = new LinkCore();
	const missing = await core.hub.request(
		"UnknownPlugin", "UICO", "describe", {}, { origin: "user" });
	assert.equal(missing.ok, false);
	addCaller(core);
	const mutation = await core.hub.request(
		"UITestCaller", "UICO", "UI.Create", {}, { origin: "user" });
	assert.equal(mutation.ok, false);
	assert.equal(mutation.status, 403);
});

test("PR23.3 UISP validates geometry and immutable snapshots", () => {
	const value = {
		uiId: "plugin.button", kind: "button",
		parentId: "plugin.panel", owner: "plugin",
		geometry: {
			space: "window", x: 10, y: 20, width: 120, height: 32
		},
		appearance: { color: "token.primary" },
		interaction: { enabled: true },
		accessibility: { role: "button" }, revision: 0
	};
	const checked = UISP.validate(value);
	assert.equal(checked.ok, true);
	assert.equal(Object.isFrozen(checked.value.geometry), true);
	assert.equal(UISP.validate({
		...value, geometry: { ...value.geometry, width: -10 }
	}).ok, false);
	assert.equal(UISP.validate({
		...value, appearance: { onClick: () => 1 }
	}).ok, false);
});
