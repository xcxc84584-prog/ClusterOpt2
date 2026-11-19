import { UICOVTETriggerPolicy } from
	"../property/UICOVTETriggerPolicy.js";
import { UICOContractCompatibilityPolicy } from
	"../property/UICOContractCompatibilityPolicy.js";
import { UIProtocolPolicy } from "../property/UIProtocolPolicy.js";
import { UISP } from "../property/UISP.js";

const STORE_KEY = "cluster.uico.vte.v1";

/**
 * The runner owns scheduling and audit, not a second OCDA registry.
 * It only reads static descriptors and executes in a detached VTE domain.
 */
export class UICOVTERunner {
	constructor(core, createSandbox, storage = null) {
		this.core = core;
		this.createSandbox = createSandbox;
		this.storage = storage;
		this.active = null;
		this.sequence = 0;
	}

	snapshot() {
		return {
			version: this.core.version,
			actions: {
				...UIProtocolPolicy.capabilities,
				"UISP.version": String(UISP.version)
			}
		};
	}

	readRecord() {
		try {
			const value = this.storage?.getItem(STORE_KEY);
			const record = value ? JSON.parse(value) : null;
			if (record && typeof record === "object" &&
				!Array.isArray(record)) return record;
		} catch {
			// Storage failure must not mutate application state.
		}
		return {};
	}

	saveRecord(record) {
		try {
			this.storage?.setItem(STORE_KEY, JSON.stringify(record));
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * On launch, preserve the old contract before recording this opening.
	 * An explicit manual test also runs for an unchanged version.
	 */
	startup() {
		const prior = this.readRecord();
		const decision = UICOVTETriggerPolicy.evaluate({
			currentVersion: this.core.version,
			previousOpenedVersion: prior.openedVersion ?? null,
			previousTestStatus: prior.status ?? null,
			manual: false,
			inFlight: Boolean(this.active)
		});
		const current = this.snapshot();
		const record = {
			...prior, openedVersion: this.core.version,
			currentSnapshot: current
		};
		if (prior.openedVersion && prior.openedVersion !==
			this.core.version) {
			record.baseline = prior.currentSnapshot ?? null;
		}
		this.saveRecord(record);
		if (decision.run) {
			// Schedule after the synchronous application initialization.
			Promise.resolve().then(() => this.run(false, decision.reasons));
		}
		return decision;
	}

	run(manual = true, reasons = null) {
		if (this.active) return this.active;
		const cause = reasons ?? (manual ? ["manual"] : ["previous-error"]);
		const runId = "uico-vte-" + (++this.sequence);
		const job = Promise.resolve().then(async () => {
			const prior = this.readRecord();
			const current = this.snapshot();
			const compared = UICOContractCompatibilityPolicy.compare(
				prior.baseline, current);
			const sandbox = this.createSandbox();
			const catalog = await sandbox.core.hub.request(
				"VTE", "UICO", "describe", {}, { origin: "user" });
			const forbidden = await sandbox.core.hub.request(
				"VTE", "UICO", "UI.Create", {}, { origin: "user" });
			const isolated = catalog.ok === true &&
				catalog.value?.protocol === UIProtocolPolicy.protocol &&
				forbidden.ok === false && forbidden.status === 403;
			const status = isolated ? compared.status : "FAIL";
			const issues = isolated ? compared.issues :
				[...compared.issues, "VTE_RELATION_FAILURE"];
			const record = {
				...prior, openedVersion: this.core.version,
				currentSnapshot: current, status: status.toLowerCase(),
				lastRunId: runId
			};
			this.saveRecord(record);
			this.core.omu.record(
				status === "PASS" ? "Log" : "EHU",
				"VTE", "UICO_TEST", status === "PASS" ? 200 : 422,
				"UICO", { runId, reasons: cause, status, issues });
			return Object.freeze({
				runId, status, reasons: [...cause], issues
			});
		}).catch(error => {
			this.saveRecord({
				...this.readRecord(), status: "error",
				lastRunId: runId
			});
			this.core.omu.record("EHU", "VTE", "UICO_TEST", 500,
				"UICO", { runId, reason: "Runner failure" });
			return Object.freeze({
				runId, status: "FAIL", issues: ["RUNNER_ERROR"]
			});
		}).finally(() => {
			this.active = null;
		});
		this.active = job;
		return job;
	}
}
