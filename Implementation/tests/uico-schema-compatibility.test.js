import test from "node:test";
import assert from "node:assert/strict";
import { UICOContractCompatibilityPolicy as policy } from
	"../property/UICOContractCompatibilityPolicy.js";
import { UICOActionContractDescriptors } from
	"../property/UICOActionContractDescriptors.js";
import { UIProtocolPolicy } from "../property/UIProtocolPolicy.js";
import { UISP } from "../property/UISP.js";

const make = (actions) => ({ version: "PR23.7", actions });
const item = (requestSchema, responseSchema, capability = "ui.read") => ({
	capability, requestSchema, responseSchema
});
const clone = value => JSON.parse(JSON.stringify(value));

test("PR23.7 stable fingerprints ignore object key order", () => {
	const a = { type: "object", properties: { x: { type: "number" } } };
	const b = { properties: { x: { type: "number" } }, type: "object" };
	assert.equal(policy.fingerprint(a), policy.fingerprint(b));
});

test("PR23.7 per-action request and response changes fail independently", () => {
	const old = make({ "UI.List": item({ type: "object" },
		{ type: "object" }) });
	const request = clone(old);
	request.actions["UI.List"].requestSchema.required = ["uiId"];
	assert.deepEqual(policy.compare(old, request).issues,
		["REQUEST_SCHEMA_CHANGED:UI.List"]);
	const response = clone(old);
	response.actions["UI.List"].responseSchema.required = ["data"];
	assert.deepEqual(policy.compare(old, response).issues,
		["RESPONSE_SCHEMA_CHANGED:UI.List"]);
	const capability = clone(old);
	capability.actions["UI.List"].capability = "ui.admin";
	assert.deepEqual(policy.compare(old, capability).issues,
		["CAPABILITY_CHANGED:UI.List"]);
});

test("PR23.7 added action compatible; removed action breaks", () => {
	const old = make({ "UI.List": item({}, {}) });
	const extended = clone(old);
	extended.actions["UI.Describe"] = item({}, {});
	assert.equal(policy.compare(old, extended).status, "PASS");
	assert.deepEqual(policy.compare(extended, old).issues,
		["REMOVED:UI.Describe"]);
});

test("PR23.7 migration is UNVERIFIED, malformed current FAIL", () => {
	const old = make({ "UI.List": "ui.read" });
	const next = make({ "UI.List": item({}, {}) });
	assert.deepEqual(policy.compare(old, next).issues,
		["SCHEMA_BASELINE_MIGRATION"]);
	assert.equal(policy.compare(old, next).status, "UNVERIFIED");
	const broken = make({ "UI.List": item({ type: "object" }, null) });
	assert.deepEqual(policy.compare(next, broken).issues,
		["INVALID_CURRENT_CONTRACT"]);
	assert.equal(policy.compare(next, broken).status, "FAIL");
	assert.equal(policy.compare(null, next).status, "UNVERIFIED");
});

test("PR23.7 descriptor inventory covers every policy action", () => {
	const actions = UICOActionContractDescriptors.build(
		UIProtocolPolicy.capabilities, UISP.version);
	for (const [name, capability] of Object.entries(
		UIProtocolPolicy.capabilities)) {
		assert.equal(actions[name].capability, capability);
		assert.equal(actions[name].requestSchema.properties.action.const, name);
		assert.ok(actions[name].responseSchema.properties.status);
	}
	assert.equal(policy.compare(make(actions), make(clone(actions))).status,
		"PASS");
});

test("PR23.7 legacy migration still rejects breaking API changes", () => {
	const legacy = make({
		"UI.List": "ui.read",
		"UI.Describe": "ui.read"
	});
	const typed = (capability = "ui.read") => item(
		{ type: "object" }, { type: "object" }, capability);
	const removed = make({ "UI.List": typed() });
	assert.equal(policy.compare(legacy, removed).status, "FAIL");
	assert.deepEqual(policy.compare(legacy, removed).issues,
		["REMOVED:UI.Describe"]);

	const changed = make({
		"UI.List": typed("ui.admin"),
		"UI.Describe": typed()
	});
	assert.equal(policy.compare(legacy, changed).status, "FAIL");
	assert.deepEqual(policy.compare(legacy, changed).issues,
		["CAPABILITY_CHANGED:UI.List"]);

	const unchanged = make({
		"UI.List": typed(),
		"UI.Describe": typed()
	});
	assert.equal(policy.compare(legacy, unchanged).status, "UNVERIFIED");
	assert.deepEqual(policy.compare(legacy, unchanged).issues,
		["SCHEMA_BASELINE_MIGRATION"]);
});
