import test from "node:test";
import assert from "node:assert/strict";
import { LinkCore } from "../LinkCore/LinkCore.js";
import { VirtualTestEnvironment, exposeVTE } from
	"../LinkCore/VirtualTestEnvironment.js";
import { UICOVTERunner } from "../LinkCore/UICOVTERunner.js";
import { UICOContractCompatibilityPolicy as compare } from
	"../property/UICOContractCompatibilityPolicy.js";

function storage() {
	const values = new Map();
	return {
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value)
	};
}

test("PR23.7 detects removed and changed static contracts", () => {
	const old = { version: "old", actions: { "UI.List": "ui.read" } };
	assert.equal(compare.compare(null, old).status, "UNVERIFIED");
	assert.equal(compare.compare(old, old).status, "UNVERIFIED");
	assert.equal(compare.compare(old, {
		version: "new", actions: {}
	}).status, "FAIL");
	assert.equal(compare.compare(old, {
		version: "new", actions: { "UI.List": "ui.write" }
	}).status, "FAIL");
});

test("PR23.7 console facade exposes manual UICO_TEST", async () => {
	const core = new LinkCore();
	const win = { localStorage: storage() };
	exposeVTE(win, core);
	assert.equal(typeof win.VTE.UICO_TEST, "function");
	const result = await win.VTE.UICO_TEST();
	assert.equal(result.status, "UNVERIFIED");
	assert.equal(result.issues.includes("MISSING_BASELINE"), true);
	assert.ok(core.omu.snapshot().logs.some(entry =>
		entry.kind === "EHU" && entry.action === "UICO_TEST"));
});

test("PR23.7 compares stored baseline and succeeds on match", async () => {
	const core = new LinkCore();
	const store = storage();
	const runner = new UICOVTERunner(
		core, () => new VirtualTestEnvironment(), store);
	const now = runner.snapshot();
	store.setItem("cluster.uico.vte.v1", JSON.stringify({
		openedVersion: "0.0.14", baseline: now,
		currentSnapshot: now, status: "pass"
	}));
	const trigger = runner.startup();
	assert.equal(trigger.run, true);
	const result = await runner.run(true);
	assert.equal(result.status, "PASS");
});

test("PR23.7 coalesces concurrent requests into one job", async () => {
	const core = new LinkCore();
	const runner = new UICOVTERunner(
		core, () => new VirtualTestEnvironment(), storage());
	const a = runner.run();
	const b = runner.run();
	assert.strictEqual(a, b);
	const result = await a;
	assert.equal(result.status, "UNVERIFIED");
});

test("PR23.7 same-version no-error startup does not run", () => {
	const core = new LinkCore();
	const store = storage();
	store.setItem("cluster.uico.vte.v1", JSON.stringify({
		openedVersion: core.version, status: "pass"
	}));
	const runner = new UICOVTERunner(
		core, () => new VirtualTestEnvironment(), store);
	assert.equal(runner.startup().status, "skip");
});

test("PR23.7 console remains accessible when storage is denied", async () => {
	const core = new LinkCore();
	const win = {};
	Object.defineProperty(win, "localStorage", {
		get() { throw new Error("SecurityError"); }
	});
	exposeVTE(win, core);
	assert.equal(typeof win.VTE.UICO_TEST, "function");
	assert.equal((await win.VTE.UICO_TEST()).status, "UNVERIFIED");
});

test("PR23.7 interrupted startup persists pending and retries on reload",
	async () => {
		const core = new LinkCore();
		const store = storage();
		const first = new UICOVTERunner(
			core, () => new VirtualTestEnvironment(), store);
		const snapshot = first.snapshot();
		store.setItem("cluster.uico.vte.v1", JSON.stringify({
			openedVersion: "0.0.14", currentSnapshot: snapshot, status: "pass"
		}));
		assert.equal(first.startup().run, true);
		assert.equal(JSON.parse(store.getItem("cluster.uico.vte.v1"))
			.status, "pending");
		const resumed = new UICOVTERunner(
			core, () => new VirtualTestEnvironment(), store);
		const decision = resumed.startup();
		assert.equal(decision.run, true);
		assert.deepEqual(decision.reasons, ["previous-incomplete"]);
		const results = await Promise.all([first.run(), resumed.run()]);
		assert.ok(results.every(result => result.status === "PASS"));
	});

test("PR23.7 corrupted persisted records never produce a false PASS",
	async () => {
		const core = new LinkCore();
		const store = storage();
		store.setItem("cluster.uico.vte.v1", "{malformed");
		const runner = new UICOVTERunner(
			core, () => new VirtualTestEnvironment(), store);
		const decision = runner.startup();
		assert.deepEqual(decision.reasons, ["previous-error"]);
		const report = await runner.run(false, decision.reasons);
		assert.equal(report.status, "UNVERIFIED");
		assert.equal(report.issues.includes("MISSING_BASELINE"), true);
		assert.equal(JSON.parse(store.getItem("cluster.uico.vte.v1"))
			.status, "unverified");
		assert.ok(core.omu.snapshot().logs.some(entry =>
			entry.kind === "EHU" && entry.action === "UICO_TEST"));
	});

test("PR23.7 rejects forged stored PASS with invalid version or state",
	async () => {
		for (const record of [
			{ openedVersion: 42, status: "pass" },
			{ openedVersion: "../bad", status: "pass" },
			{ openedVersion: "0.0.15b", status: "unknown" }
		]) {
			const core = new LinkCore();
			const store = storage();
			store.setItem("cluster.uico.vte.v1", JSON.stringify(record));
			const runner = new UICOVTERunner(
				core, () => new VirtualTestEnvironment(), store);
			const decision = runner.startup();
			assert.equal(decision.run, true);
			assert.deepEqual(decision.reasons, ["previous-error"]);
			assert.equal((await runner.run()).status, "UNVERIFIED");
		}
	});
