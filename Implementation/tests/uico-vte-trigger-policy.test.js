import test from "node:test";
import assert from "node:assert/strict";
import { UICOVTETriggerPolicy as policy } from
	"../property/UICOVTETriggerPolicy.js";

const baseline = {
	currentVersion: "0.0.15b",
	previousOpenedVersion: "0.0.15b",
	previousTestStatus: "pass",
	manual: false,
	inFlight: false
};

test("PR23.7 skips unchanged versions with no previous error", () => {
	assert.deepEqual(policy.evaluate(baseline).reasons, []);
	assert.equal(policy.evaluate(baseline).status, "skip");
});

test("PR23.7 triggers on authoritative version changes", () => {
	const result = policy.evaluate({
		...baseline, previousOpenedVersion: "0.0.15a"
	});
	assert.equal(result.run, true);
	assert.deepEqual(result.reasons, ["version-change"]);
});

test("PR23.7 retries previous UICO-related failures", () => {
	for (const state of ["fail", "error", "unverified"]) {
		const result = policy.evaluate({
			...baseline, previousTestStatus: state
		});
		assert.equal(result.run, true);
		assert.deepEqual(result.reasons, ["previous-error"]);
	}
});

test("PR23.7 manual console request forces recheck", () => {
	const result = policy.evaluate({ ...baseline, manual: true });
	assert.equal(result.run, true);
	assert.deepEqual(result.reasons, ["manual"]);
});

test("PR23.7 coalesces triggers while a job is active", () => {
	const result = policy.evaluate({
		...baseline, manual: true, previousTestStatus: "fail",
		inFlight: true
	});
	assert.equal(result.run, false);
	assert.equal(result.status, "coalesced");
	assert.deepEqual(result.reasons, ["previous-error", "manual"]);
});

test("PR23.7 fails closed on invalid version or flags", () => {
	assert.equal(policy.evaluate({
		...baseline, currentVersion: "../bad"
	}).status, "invalid");
	assert.equal(policy.evaluate({
		...baseline, manual: "yes"
	}).run, false);
	assert.equal(policy.evaluate(null).status, "invalid");
});

test("PR23.7 preserves all simultaneous trigger reasons", () => {
	const result = policy.evaluate({
		...baseline, previousOpenedVersion: "0.0.14",
		previousTestStatus: "error", manual: true
	});
	assert.equal(result.run, true);
	assert.deepEqual(result.reasons, [
		"version-change", "previous-error", "manual"
	]);
	assert.equal(Object.isFrozen(result.reasons), true);
});

test("PR23.7 retries an interrupted pending launch without mislabeling error", () => {
	const result = policy.evaluate({
		...baseline, previousTestStatus: "pending"
	});
	assert.equal(result.run, true);
	assert.deepEqual(result.reasons, ["previous-incomplete"]);
	assert.equal(result.status, "scheduled");
});
